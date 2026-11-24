// register.exe — GUI setup for the card reader native messaging host.
//
//   - Double-click (no args): shows a dialog to enter the Extension ID, then registers.
//   - register.exe -id <extension-id>: register directly (no dialog), for scripting/testing.
//
// No PowerShell / regedit / admin required: writes only the current user's registry (HKCU).
//
// build: go build -ldflags "-H windowsgui" -o register.exe ./cmd/register
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ncruces/zenity"
	"golang.org/x/sys/windows/registry"
)

const hostName = "postfamily_card_reader"

func main() {
	// CLI mode (for scripting / testing)
	if len(os.Args) >= 3 && (os.Args[1] == "-id" || os.Args[1] == "--id") {
		hostExe, err := locateHost()
		if err != nil {
			writeLog("ERROR: " + err.Error())
			os.Exit(1)
		}
		if err := register(hostExe, strings.TrimSpace(os.Args[2])); err != nil {
			writeLog("ERROR: " + err.Error())
			os.Exit(1)
		}
		writeLog("OK: registered extension " + strings.TrimSpace(os.Args[2]))
		return
	}

	// GUI mode (double-click)
	hostExe, err := locateHost()
	if err != nil {
		zenity.Error(err.Error(), zenity.Title("ลงทะเบียนเครื่องอ่านบัตร"))
		return
	}

	id, err := zenity.Entry(
		"ใส่ Extension ID ของ extension นี้\n\n(เปิด chrome://extensions → โหมดนักพัฒนา →\nดู ID ใต้ชื่อ 'POST Family AutoFill')",
		zenity.Title("ลงทะเบียนเครื่องอ่านบัตร"),
	)
	if err != nil {
		return // user cancelled
	}
	id = strings.TrimSpace(id)
	if id == "" {
		zenity.Error("ยังไม่ได้ใส่ Extension ID", zenity.Title("ลงทะเบียนเครื่องอ่านบัตร"))
		return
	}

	if err := register(hostExe, id); err != nil {
		zenity.Error("ลงทะเบียนไม่สำเร็จ:\n"+err.Error(), zenity.Title("ลงทะเบียนเครื่องอ่านบัตร"))
		return
	}

	zenity.Info(
		"ลงทะเบียนสำเร็จ!\n\nขั้นต่อไป:\n1. reload extension ที่ chrome://extensions\n2. เปิด Side Panel แล้วกด 'อ่านบัตร'",
		zenity.Title("สำเร็จ"),
	)
}

func locateHost() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("หาตำแหน่งโปรแกรมไม่สำเร็จ: %v", err)
	}
	dir := filepath.Dir(exePath)
	hostExe := filepath.Join(dir, hostName+".exe")
	if _, err := os.Stat(hostExe); err != nil {
		return "", fmt.Errorf("ไม่พบ %s ในโฟลเดอร์เดียวกัน\n\nวาง register.exe กับ %s ไว้ในโฟลเดอร์เดียวกัน", hostName+".exe", hostName+".exe")
	}
	return hostExe, nil
}

func register(hostExe, extensionID string) error {
	manifestPath := filepath.Join(filepath.Dir(hostExe), hostName+".json")

	manifest := map[string]interface{}{
		"name":           hostName,
		"description":    "Read Thai national ID card via smart card reader (PC/SC)",
		"path":           hostExe,
		"type":           "stdio",
		"allowed_origins": []string{"chrome-extension://" + extensionID + "/"},
	}
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(manifestPath, data, 0644); err != nil {
		return fmt.Errorf("เขียน manifest ไม่สำเร็จ: %v", err)
	}

	keyPath := `Software\Google\Chrome\NativeMessagingHosts\` + hostName
	k, _, err := registry.CreateKey(registry.CURRENT_USER, keyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("เขียน registry ไม่สำเร็จ: %v", err)
	}
	defer k.Close()
	if err := k.SetStringValue("", manifestPath); err != nil {
		return fmt.Errorf("เขียนค่า registry ไม่สำเร็จ: %v", err)
	}
	return nil
}

func writeLog(msg string) {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	logPath := filepath.Join(filepath.Dir(exe), "register.log")
	os.WriteFile(logPath, []byte(msg+"\n"), 0644)
}
