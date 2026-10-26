import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

PORT = 8098

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()

async def run_tests():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    await asyncio.sleep(0.5)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("=== BROWSER TEST: Admin Dashboard Authentication & Security ===")
        await page.goto(f"http://localhost:{PORT}/admin.html")
        await page.wait_for_timeout(500)

        # 1. Verify Passcode Modal visible
        overlay_visible = await page.is_visible("#authOverlay")
        print(f"1. Security Auth Modal Visible: {overlay_visible}")
        assert overlay_visible, "Passcode overlay must be visible"

        # 2. Test Invalid Auth Submission
        await page.fill("#adminEmail", "invalid@admin.com")
        await page.fill("#adminPassword", "wrongpassword")
        await page.click("#authLoginBtn")
        await page.wait_for_timeout(1000)

        auth_error_visible = await page.is_visible("#authError")
        print(f"2. Invalid Credentials Submission Error Visible: {auth_error_visible}")
        assert auth_error_visible, "Error banner should display on failed auth"

        await page.screenshot(path="admin_verification.png")
        await browser.close()
        print("\nADMIN DASHBOARD INTEGRATION TEST PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    asyncio.run(run_tests())
