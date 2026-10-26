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

        print("=== BROWSER TEST: Admin Dashboard Authentication & Navigation ===")
        await page.goto(f"http://localhost:{PORT}/admin.html")
        await page.wait_for_timeout(500)

        # 1. Verify Passcode Modal visible
        overlay_visible = await page.is_visible("#authOverlay")
        print(f"1. Security Passcode Modal Visible: {overlay_visible}")
        assert overlay_visible, "Passcode overlay must be visible"

        # 2. Enter Passcode
        await page.fill("#adminPasscode", "nolyadmin123")
        await page.click("#authLoginBtn")
        await page.wait_for_timeout(500)

        overlay_hidden = not (await page.is_visible("#authOverlay"))
        content_visible = await page.is_visible("#dashboardContent")
        print(f"2. Authenticated - Overlay Hidden: {overlay_hidden}, Content Visible: {content_visible}")
        assert overlay_hidden and content_visible, "Dashboard should unlock on valid passcode"

        # 3. Test Tab Switching
        await page.click("button[data-tab='tab-company-wallet']")
        await page.wait_for_timeout(200)
        wallet_tab_active = await page.is_visible("#tab-company-wallet")
        print(f"3. Company Wallet Tab Active: {wallet_tab_active}")
        assert wallet_tab_active, "Company Wallet tab should display"

        await page.click("button[data-tab='tab-match-money']")
        await page.wait_for_timeout(200)
        match_money_active = await page.is_visible("#tab-match-money")
        print(f"4. Paid Match Config Tab Active: {match_money_active}")
        assert match_money_active, "Paid Match Config tab should display"

        await page.screenshot(path="admin_verification.png")
        await browser.close()
        print("\nADMIN DASHBOARD INTEGRATION TEST PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    asyncio.run(run_tests())
