// postfamily_card_reader — Native Messaging host for Chrome.
//
// อ่านข้อมูลจากบัตรประชาชนไทยผ่านเครื่องอ่าน smart card (PC/SC)
// และตอบกลับ extension ผ่าน Chrome Native Messaging protocol (stdin/stdout).
//
// build (เครื่อง dev):  go build -ldflags "-H windowsgui" -o postfamily_card_reader.exe
package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/ebfe/scard"
	"golang.org/x/text/encoding/charmap"
)

// ==========================================
// Native Messaging protocol (stdin/stdout)
// ==========================================

// readMessage อ่าน 4-byte little-endian length + UTF-8 JSON จาก reader
func readMessage(r io.Reader) ([]byte, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, err
	}
	if length == 0 || length > 1<<20 {
		return nil, errors.New("invalid message length")
	}
	buf := make([]byte, length)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

// writeMessage เขียน 4-byte little-endian length + UTF-8 JSON ไปที่ writer
func writeMessage(w io.Writer, v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(data))); err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

// ==========================================
// APDU commands (บัตรประชาชนไทย)
// ==========================================

var (
	selectThaiCard = []byte{0x00, 0xA4, 0x04, 0x00, 0x08, 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01}
	cmdCID         = []byte{0x80, 0xB0, 0x00, 0x04, 0x02, 0x00, 0x0D} // เลขบัตร 13 หลัก
	cmdTHFullname  = []byte{0x80, 0xB0, 0x00, 0x11, 0x02, 0x00, 0x64} // ชื่อ-นามสกุล (ไทย)
	cmdBirth       = []byte{0x80, 0xB0, 0x00, 0xD9, 0x02, 0x00, 0x08} // วันเกิด (พ.ศ.)
	cmdAddress     = []byte{0x80, 0xB0, 0x15, 0x79, 0x02, 0x00, 0x64} // ที่อยู่
)

// ==========================================
// Data types (ตรงกับที่ popup.js คาดหวัง)
// ==========================================

type Response struct {
	Success bool      `json:"success"`
	Data    *CardData `json:"data,omitempty"`
	Error   string    `json:"error,omitempty"`
}

type CardData struct {
	FirstName   string      `json:"firstName"`
	LastName    string      `json:"lastName"`
	CitizenID   string      `json:"citizenId"`
	DateOfBirth DateOfBirth `json:"dateOfBirth"`
	Address     Address     `json:"address"`
}

type DateOfBirth struct {
	Day   string `json:"day"`
	Month string `json:"month"`
	Year  string `json:"year"`
}

type Address struct {
	HouseNo     string `json:"houseNo"`
	Moo         string `json:"moo"`
	Soi         string `json:"soi"`
	Road        string `json:"road"`
	SubDistrict string `json:"subDistrict"`
	District    string `json:"district"`
	Province    string `json:"province"`
}

// ==========================================
// PC/SC + APDU
// ==========================================

// readData ส่ง READ BINARY แล้วตามด้วย GET RESPONSE เพื่อดึงข้อมูลจริง
func readData(card *scard.Card, cmd []byte, getRespPrefix []byte) ([]byte, error) {
	if _, err := card.Transmit(cmd); err != nil {
		return nil, err
	}
	req := append(append([]byte{}, getRespPrefix...), cmd[len(cmd)-1])
	resp, err := card.Transmit(req)
	if err != nil {
		return nil, err
	}
	if len(resp) >= 2 {
		resp = resp[:len(resp)-2] // ตัด SW1 SW2 ทิ้ง
	}
	return resp, nil
}

func readCard() (*CardData, error) {
	ctx, err := scard.EstablishContext()
	if err != nil {
		return nil, fmt.Errorf("สร้าง PC/SC context ไม่สำเร็จ: %v", err)
	}
	defer ctx.Release()

	readers, err := ctx.ListReaders()
	if err != nil {
		return nil, fmt.Errorf("ค้นหาเครื่องอ่านไม่สำเร็จ: %v", err)
	}
	if len(readers) == 0 {
		return nil, errors.New("ไม่พบเครื่องอ่านบัตร กรุณาเสียบเครื่องอ่านแล้วลองใหม่")
	}

	// ใช้ reader ตัวแรก (เครื่องใช้จริงมีเครื่องเดียว)
	card, err := ctx.Connect(readers[0], scard.ShareShared, scard.ProtocolAny)
	if err != nil {
		return nil, errors.New("เชื่อมต่อการ์ดไม่สำเร็จ — เสียบัตรประชาชนเข้าเครื่องอ่านแล้วหรือยัง?")
	}
	defer card.Disconnect(scard.LeaveCard)

	atr, err := card.GetAttrib(scard.AttrAtrString)
	if err != nil {
		return nil, fmt.Errorf("อ่าน ATR ไม่สำเร็จ: %v", err)
	}

	// บัตรไทยรุ่นใหม่ (ATR ขึ้นต้น 3B 67) ใช้ GET RESPONSE prefix ต่างกัน
	getResp := []byte{0x00, 0xC0, 0x00, 0x00}
	if len(atr) >= 2 && atr[0] == 0x3B && atr[1] == 0x67 {
		getResp = []byte{0x00, 0xC0, 0x00, 0x01}
	}

	// เลือก applet บัตรประชาชนไทย
	if _, err := card.Transmit(selectThaiCard); err != nil {
		return nil, fmt.Errorf("ส่งคำสั่ง select ไม่สำเร็จ: %v", err)
	}

	cidRaw, err := readData(card, cmdCID, getResp)
	if err != nil {
		return nil, err
	}
	thRaw, err := readData(card, cmdTHFullname, getResp)
	if err != nil {
		return nil, err
	}
	birthRaw, err := readData(card, cmdBirth, getResp)
	if err != nil {
		return nil, err
	}
	addrRaw, err := readData(card, cmdAddress, getResp)
	if err != nil {
		return nil, err
	}

	cid := clean(decodeTis620(cidRaw))
	if len(cid) < 13 {
		return nil, errors.New("การ์ดที่อ่านไม่ใช่บัตรประชาชน (อ่านเลขบัตรไม่ครบ)")
	}

	firstName, lastName := parseThaiName(decodeTis620(thRaw))
	day, month, year := parseBirth(string(birthRaw))
	address := parseAddress(decodeTis620(addrRaw))

	return &CardData{
		FirstName:   firstName,
		LastName:    lastName,
		CitizenID:   cid,
		DateOfBirth: DateOfBirth{Day: day, Month: month, Year: year},
		Address:     address,
	}, nil
}

// ==========================================
// Decode / parse
// ==========================================

// decodeTis620 ถอดรหัส TIS-620 (ข้อมูลไทย) เป็น UTF-8 ผ่าน Windows-874
func decodeTis620(data []byte) string {
	decoder := charmap.Windows874.NewDecoder()
	out, err := decoder.Bytes(data)
	if err != nil {
		return string(data) // fallback
	}
	return string(out)
}

// clean ตัดช่องว่าง / # / null ออกทั้งหัวท้าย
func clean(s string) string {
	return strings.Trim(s, "# \t\r\n\x00")
}

// parseThaiName แยกชื่อ/นามสกุลจาก format "คำนำหน้า#ชื่อ#ชื่อกลาง#นามสกุล"
func parseThaiName(raw string) (firstName, lastName string) {
	s := clean(raw)
	parts := strings.Split(s, "#")
	p := make([]string, 4)
	for i := range p {
		if i < len(parts) {
			p[i] = strings.TrimSpace(parts[i])
		}
	}
	firstName = p[1]
	lastName = p[3]
	if lastName == "" {
		lastName = p[2]
	}
	return firstName, lastName
}

// parseBirth แยกวัน/เดือน/ปี จาก "YYYYMMDD" (พ.ศ.)
func parseBirth(s string) (day, month, year string) {
	s = clean(s)
	if len(s) >= 8 {
		year = s[0:4]
		month = s[4:6]
		day = s[6:8]
	}
	return day, month, year
}

// stripPrefix ตัดคำนำหน้าไทย (ตำบล/แขวง, อำเภอ/เขต, จังหวัด) ออก
func stripPrefix(s string, prefixes ...string) string {
	s = strings.TrimSpace(s)
	for _, p := range prefixes {
		if strings.HasPrefix(s, p) {
			return strings.TrimSpace(strings.TrimPrefix(s, p))
		}
	}
	return s
}

// parseAddress แยกที่อยู่จาก format "บ้านเลขที่#หมู่/ซอย#...#ตำบล#อำเภอ#จังหวัด"
func parseAddress(raw string) Address {
	s := clean(raw)
	if s == "" {
		return Address{}
	}
	parts := strings.Split(s, "#")
	n := len(parts)

	if n < 3 {
		// ไม่มีตัวคั่น # — ส่งค่าเดิมเข้า houseNo (ให้ผู้ใช้แก้ในฟอร์ม)
		return Address{HouseNo: s}
	}

	a := Address{
		HouseNo:     strings.TrimSpace(parts[0]),
		SubDistrict: stripPrefix(parts[n-3], "ตำบล", "แขวง"),
		District:    stripPrefix(parts[n-2], "อำเภอ", "เขต"),
		Province:    stripPrefix(parts[n-1], "จังหวัด"),
	}

	// ส่วนกลาง (ระหว่างบ้านเลขที่ กับ 3 ฟิลด์สุดท้าย) = หมู่/ซอย/ถนน
	var roadParts []string
	for i := 1; i < n-3; i++ {
		p := strings.TrimSpace(parts[i])
		if p == "" {
			continue
		}
		switch {
		case strings.HasPrefix(p, "หมู่ที่"):
			a.Moo = strings.TrimSpace(strings.TrimPrefix(p, "หมู่ที่"))
		case strings.HasPrefix(p, "ซอย"):
			a.Soi = strings.TrimSpace(strings.TrimPrefix(p, "ซอย"))
		case strings.HasPrefix(p, "ถนน"):
			roadParts = append(roadParts, strings.TrimSpace(strings.TrimPrefix(p, "ถนน")))
		default:
			roadParts = append(roadParts, p)
		}
	}
	a.Road = strings.Join(roadParts, " ")
	return a
}

// ==========================================
// main
// ==========================================

func main() {
	for {
		msg, err := readMessage(os.Stdin)
		if err != nil {
			return // EOF หรือข้อผิดพลาด → จบ (Chrome ปิด process อยู่แล้ว)
		}

		var req struct {
			Command string `json:"command"`
		}
		if err := json.Unmarshal(msg, &req); err != nil {
			writeMessage(os.Stdout, Response{Success: false, Error: "คำขอไม่ถูกต้อง"})
			continue
		}

		switch req.Command {
		case "ping":
			writeMessage(os.Stdout, Response{Success: true})
		case "read":
			data, err := readCard()
			if err != nil {
				writeMessage(os.Stdout, Response{Success: false, Error: err.Error()})
			} else {
				writeMessage(os.Stdout, Response{Success: true, Data: data})
			}
		default:
			writeMessage(os.Stdout, Response{Success: false, Error: "ไม่รู้จักคำสั่ง: " + req.Command})
		}
	}
}
