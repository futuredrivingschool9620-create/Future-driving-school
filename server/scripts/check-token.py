import urllib.request
import json

env = {}
with open('server/.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k] = v.strip('"\'')

token = env.get('WHATSAPP_API_TOKEN', '')
print('Token prefix:', token[:20], 'length:', len(token))

url = f'https://graph.facebook.com/v25.0/debug_token?input_token={token}&access_token={token}'
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        print('Token debug:', json.loads(resp.read().decode()))
except Exception as e:
    print('Error:', e)
