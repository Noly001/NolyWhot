import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os

PORT = 8091

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server():
    handler = http.server.SimpleHTTPRequestHandler
    httpd = ReusableTCPServer(("", PORT), handler)
    httpd.serve_forever()

async def run_tests():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    await asyncio.sleep(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("--- TEST 1: LOGIN PAGE LOAD ---")
        await page.goto(f"http://localhost:{PORT}/index.html")
        await page.wait_for_timeout(1000)
        login_btn = await page.is_visible("#loginButton")
        print("Login Button Visible:", login_btn)
        assert login_btn

        print("--- TEST 2: ADMIN DASHBOARD ACCESSIBILITY ---")
        await page.goto(f"http://localhost:{PORT}/admin.html")
        await page.wait_for_timeout(1000)

        admin_overlay = await page.is_visible("#authOverlay")
        print("Admin Auth Overlay Displayed:", admin_overlay)
        assert admin_overlay

        admin_header = await page.text_content(".admin-title")
        print("Admin Header Title:", admin_header)
        assert "ADMIN" in admin_header.upper()

        print("--- TEST 3: GAME MODE SELECTION & STAKE CONFIGURATION ---")
        await page.goto(f"http://localhost:{PORT}/play.html?mode=online")
        await page.wait_for_timeout(1000)

        stake_card = await page.is_visible(".stake-selector-card")
        print("Stake Selector Card Visible in Online Lobby:", stake_card)
        assert stake_card

        # Select a stake option
        await page.click("button[data-stake='500']")
        summary_text = await page.text_content("#stakeSummaryText")
        print("Updated Stake Summary:", summary_text)
        assert "500" in summary_text

        # Take screenshot for visual verification
        os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
        await page.screenshot(path="/home/jules/verification/screenshots/verification.png")
        print("Saved visual screenshot to /home/jules/verification/screenshots/verification.png")

        await browser.close()
        print("ALL PLAYWRIGHT INTEGRATION TESTS COMPLETED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    asyncio.run(run_tests())
