import urllib.request
import json

token = "EAAUurdeulKcBScOmvTkCqt3mPdLACpuC4l7OWZCDOwPFdQQ9LArKy5iyUNntRjd2ZBPDWtV1Sn9gnTHkevoFxKH0cnGdM1sR1ZATbvnmkEoxVqdHhoNpcFJcg1T2QcJxFuyZAXUnhyrojTzuyKPo3LM1XeIZBi0fUc5jNxMEn7eznaBUJ5Nz5I5GMdjlmakUkQAZDZD"
apiUrl = "https://graph.facebook.com/v25.0"
phoneId = "1426657943854134"

# Test sending future_driving_school with en, en_US, en_GB
# Sending to admin phone 918317370639
logoUrl = "https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/client/public/whatsapp-banner.png"

for lang in ["en", "en_US", "en_GB"]:
    for withHeader in [True, False]:
        components = []
        if withHeader:
            components.append({
                "type": "header",
                "parameters": [{"type": "image", "image": {"link": logoUrl}}]
            })
        components.append({
            "type": "body",
            "parameters": [
                {"type": "text", "text": "Charan salanki"},
                {"type": "text", "text": "KA09JP3222"},
                {"type": "text", "text": "Insurance"},
                {"type": "text", "text": "20 Sep 2026"},
                {"type": "text", "text": "15 days"},
            ]
        })
        payload = {
            "messaging_product": "whatsapp",
            "to": "918317370639",
            "type": "template",
            "template": {
                "name": "future_driving_school",
                "language": {"code": lang},
                "components": components
            }
        }
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{apiUrl}/{phoneId}/messages",
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"SUCCESS with lang={lang}, withHeader={withHeader}!")
                print(resp.read().decode())
                break
        except urllib.error.HTTPError as e:
            err = json.loads(e.read().decode())
            print(f"Failed lang={lang}, header={withHeader}: Code {err.get('error', {}).get('code')} - {err.get('error', {}).get('message')}")
        except Exception as e:
            print(f"Error lang={lang}, header={withHeader}: {e}")
