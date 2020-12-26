import asyncio
import websockets
import json
import string
import random

games = {}

async def handler(websocket, path):
    client_state = {}

    try:
        async for message in websocket:
            data = json.loads(message)

            assert('msg' in data)

            if data['msg'] == 'start':
                assert('player' in data and isinstance(data['player'], int))
                assert('pool' in data and (isinstance(data['pool'], int) or isinstance(data['pool'], float)))
                assert('inc' in data and (isinstance(data['inc'], int) or isinstance(data['inc'], float)))

                client_state['game_id'] = ''.join(random.choice(string.ascii_letters) for i in range(10))
                
                print(f"Game {client_state['game_id']} created!")
                
                client_state['player'] = data['player']

                games[client_state['game_id']] = {
                    'players':[None, None, None, None], 
                    'pool':data['pool'], 'inc':data['inc']
                }

                games[client_state['game_id']]['players'][client_state['player']] = websocket

                await websocket.send(json.dumps({
                    'msg':'game_created', 'game_id':client_state['game_id']
                }))
            
            elif data['msg'] == 'join':
                assert('game_id' in data)
                assert('player' in data and isinstance(data['player'], int))

                if data['game_id'] in games and games[data['game_id']]['players'][data['player']] is None:
                    # Success, can join the game
                    client_state['game_id'] = data['game_id']
                    client_state['player'] = data['player']
                    games[client_state['game_id']]['players'][client_state['player']] = websocket

                    await websocket.send(json.dumps({'msg':'join_success', 'success': True}))

                    if not any(p is None for p in games[client_state['game_id']]['players']):
                        await asyncio.wait([player.send(json.dumps({
                            'msg':'all_connected',
                            'pool':games[client_state['game_id']]['pool'],
                            'inc':games[client_state['game_id']]['inc']
                        })) for player in games[client_state['game_id']]['players']])

                else:
                    await websocket.send(json.dumps({'msg':'join_success', 'success': False}))
            
            else:
                # Forward all other messages to other players
                await asyncio.wait([
                    player.send(message) for player in games[client_state['game_id']]['players']
                    if player != websocket and player is not None
                ])  
    finally:
        if 'game_id' in client_state:
            games[client_state['game_id']]['players'][client_state['player']] = None

            # Clean up game if no players connected
            if all(p is None for p in games[client_state['game_id']]['players']):
                print(f"Game {client_state['game_id']} destroyed!")
                del games[client_state['game_id']]

start_server = websockets.serve(handler, "0.0.0.0", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
