import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright

PORT = 8090

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()

async def main():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    await asyncio.sleep(0.5)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Test Mode Selection Screen
        await page.goto(f"http://localhost:{PORT}/play.html?mode=select")
        await page.wait_for_timeout(500)
        mode_select_visible = await page.is_visible("#modeSelection")
        print(f"1. Mode Selection Screen Visible: {mode_select_visible}")

        # 2. Test Computer Mode & 5 Cards Deal
        await page.goto(f"http://localhost:{PORT}/play.html?mode=computer")
        await page.wait_for_timeout(500)

        player_cards = await page.query_selector_all("#playerHand .card")
        opponent_cards = await page.query_selector_all("#opponentHand .card")

        print(f"2. Player 1 hand card count: {len(player_cards)} (Expected: 5)")
        print(f"   Player 2/Computer hand card count: {len(opponent_cards)} (Expected: 5)")

        # 3. Test HOME Button Navigation from GameOver Screen
        await page.evaluate("document.getElementById('gameOverScreen').classList.remove('hidden');")
        await page.wait_for_timeout(200)
        home_visible = await page.is_visible("#homeButton")
        print(f"3. Home Button visible when GameOver is triggered: {home_visible}")

        await page.click("#homeButton")
        await page.wait_for_timeout(500)
        current_url = page.url
        print(f"   Home Button Redirect URL: {current_url} (Expected to contain 'mode=select')")

        # 4. Test Quick Match / Online Lobby UI Elements
        await page.goto(f"http://localhost:{PORT}/play.html?mode=online")
        await page.wait_for_timeout(500)
        online_lobby_visible = await page.is_visible("#onlineLobby")
        quick_match_btn = await page.is_visible("#quickMatchButton")
        create_room_btn = await page.is_visible("#createRoomButton")
        print(f"4. Online Lobby Visible: {online_lobby_visible}, Quick Match Btn: {quick_match_btn}, Create Room Btn: {create_room_btn}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
