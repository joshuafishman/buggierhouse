import asyncio
import websockets
import json
import string
import random
import os
from http import HTTPStatus
import functools

games = {}

MIME_TYPES = {
    "html": "text/html",
    "js": "text/javascript",
    "css": "text/css"
}

async def process_request(sever_root, path, request_headers):
    """Serves a file when doing a GET request with a valid path."""

    if "Upgrade" in request_headers:
        return  # Probably a WebSocket connection

    path = path.split('?')[0]

    if path == '/':
        path = '/index.html'

    response_headers = [
        ('Server', 'asyncio websocket server'),
        ('Connection', 'close'),
    ]

    # Derive full system path
    full_path = os.path.realpath(os.path.join(sever_root, path[1:]))

    # Validate the path
    if os.path.commonpath((sever_root, full_path)) != sever_root or \
            not os.path.exists(full_path) or not os.path.isfile(full_path):
        print("HTTP GET {} 404 NOT FOUND".format(path))
        print(full_path)
        return HTTPStatus.NOT_FOUND, [], b'404 NOT FOUND'

    # Guess file content type
    extension = full_path.split(".")[-1]
    mime_type = MIME_TYPES.get(extension, "application/octet-stream")
    response_headers.append(('Content-Type', mime_type))

    # Read the whole file into memory and send it out
    body = open(full_path, 'rb').read()
    response_headers.append(('Content-Length', str(len(body))))
    print("HTTP GET {} 200 OK".format(path))
    return HTTPStatus.OK, response_headers, body


async def websocket_handler(websocket, path):
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
                    'pool':data['pool'], 'inc':data['inc'],
                    'started':False
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

                    if not any(p is None for p in games[client_state['game_id']]['players']):
                        if not games[client_state['game_id']]['started']:
                            await websocket.send(json.dumps({'msg':'join_success', 'success': True}))

                            games[client_state['game_id']]['started'] = True
                            await asyncio.wait([player.send(json.dumps({
                                'msg':'all_connected',
                                'pool':games[client_state['game_id']]['pool'],
                                'inc':games[client_state['game_id']]['inc']
                            })) for player in games[client_state['game_id']]['players']])
                        else:
                            # Select a player to be responsible for the state update
                            sync_rep = games[client_state['game_id']]['players'][3-client_state['player']]

                            if sync_rep is not None:
                                await sync_rep.send(json.dumps({'msg':'reconnected'}))
                            else:
                                await websocket.send(json.dumps({'msg':'join_success', 'success': False}))
                    else:
                        await websocket.send(json.dumps({'msg':'join_success', 'success': True}))


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


handler = functools.partial(process_request, os.getcwd())
start_server = websockets.serve(websocket_handler, "localhost", 8080, process_request=handler)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
