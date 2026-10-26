import asyncio
import http.server
import socketserver
import threading
import sys
from playwright.async_api import async_playwright

PORT = 8095

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

        print("=== BROWSER TEST 1: Mode Selection Page ===")
        context1 = await browser.new_context()
        page1 = await context1.new_page()
        await page1.goto(f"http://localhost:{PORT}/play.html?mode=select")
        await page1.wait_for_timeout(500)
        mode_select_visible = await page1.is_visible("#modeSelection")
        assert mode_select_visible, "Mode selection screen should be visible"
        print("✅ Mode Selection Screen is visible.")

        print("\n=== BROWSER TEST 2: Computer Mode & 5-Card Hand ===")
        await page1.goto(f"http://localhost:{PORT}/play.html?mode=computer")
        await page1.wait_for_timeout(1000)

        p1_cards = await page1.query_selector_all("#playerHand .card")
        p2_cards = await page1.query_selector_all("#opponentHand .card")
        print(f"Player Hand Cards: {len(p1_cards)} (Expected: 5)")
        print(f"Computer Hand Cards: {len(p2_cards)} (Expected: 5)")
        assert len(p1_cards) == 5, f"Expected 5 cards, got {len(p1_cards)}"
        assert len(p2_cards) == 5, f"Expected 5 cards, got {len(p2_cards)}"

        timer_val = await page1.text_content("#turnTimer")
        print(f"Current turn timer display: {timer_val}")
        assert timer_val is not None and timer_val.isdigit(), "Timer display should be numeric"

        print("\n=== BROWSER TEST 3: HOME Button Redirect in Computer Mode ===")
        # Unhide game over screen to test home button from game-over as well
        await page1.evaluate("document.getElementById('gameOverScreen').classList.remove('hidden');")
        await page1.wait_for_timeout(200)
        await page1.click("#homeButton")
        await page1.wait_for_timeout(500)
        print(f"Redirected URL: {page1.url}")
        assert "mode=select" in page1.url, "HOME button should redirect to play.html?mode=select"
        print("✅ HOME button reliably redirected to mode selection.")

        print("\n=== BROWSER TEST 4: Online Multiplayer Room Creation & Joining ===")
        # Context 1: Player 1 (Host)
        await page1.goto(f"http://localhost:{PORT}/play.html?mode=online")
        await page1.wait_for_timeout(1000)

        await page1.click("#createRoomButton")
        await page1.wait_for_selector("#roomCodeText", timeout=5000)
        room_code = await page1.text_content("#roomCodeText")
        room_code = room_code.strip()
        print(f"Player 1 created room with code: '{room_code}'")
        assert len(room_code) == 6, f"Room code should be 6 characters, got '{room_code}'"

        # Context 2: Player 2 (Guest)
        context2 = await browser.new_context()
        page2 = await context2.new_page()
        await page2.goto(f"http://localhost:{PORT}/play.html?mode=online")
        await page2.wait_for_timeout(1000)

        await page2.fill("#roomCodeInput", room_code)
        await page2.click("#joinRoomButton")

        print("Waiting for game to start for both players...")
        await page1.wait_for_selector("#gameContainer", state="visible", timeout=10000)
        await page2.wait_for_selector("#gameContainer", state="visible", timeout=10000)

        p1_online_cards = await page1.query_selector_all("#playerHand .card")
        p2_online_cards = await page2.query_selector_all("#playerHand .card")

        print(f"Online Player 1 hand cards: {len(p1_online_cards)} (Expected: 5)")
        print(f"Online Player 2 hand cards: {len(p2_online_cards)} (Expected: 5)")
        assert len(p1_online_cards) == 5, "Online Player 1 should receive 5 cards"
        assert len(p2_online_cards) == 5, "Online Player 2 should receive 5 cards"

        # Test Stickers & Voice Chat buttons
        sticker_btn1 = await page1.is_visible("#stickerButton")
        voice_btn1 = await page1.is_visible("#voiceChatButton")
        print(f"Online Player 1 UI: Sticker button: {sticker_btn1}, Voice button: {voice_btn1}")
        assert sticker_btn1 and voice_btn1, "Stickers and Voice Chat buttons must be present"

        # Test Sticker click
        await page1.click("#stickerButton")
        panel_visible = await page1.is_visible("#stickerPanel")
        print(f"Sticker panel visible on click: {panel_visible}")

        # Test HOME button from Online Game
        await page1.evaluate("document.getElementById('gameOverScreen').classList.remove('hidden');")
        await page1.wait_for_timeout(200)
        await page1.click("#homeButton")
        await page1.wait_for_timeout(500)
        assert "mode=select" in page1.url, "HOME button in online match should redirect to mode select"

        await browser.close()
        print("\nALL BROWSER INTEGRATION TESTS PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    asyncio.run(run_tests())
