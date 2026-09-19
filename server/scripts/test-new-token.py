import urllib.request
import json

token = "EAAUurdeulKcBSWjSZC3SNPCSmaFwz8rr2XsQzb9GW3eBv6eZBMabKjHoF8w1I1PGM33lrw9ZCd6KPC4PBQilzAnCnn49ue8nXDHwIjlZC9YqCdNksOZAyGNfNNFozaDg48ZCEpoAYneWEPRyCUGccPPlHZChn6Ihsejz4EHmOGL3XMSszmA8RzaqOpTEDwGrnS1kwZDZD"
apiUrl = "https://graph.facebook.com/v25.0"

def get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "body": json.loads(e.read().decode())}
    except Exception as e:
        return {"error": str(e)}

print("=== 1. Token debug ===")
print(get(f"{apiUrl}/debug_token?input_token={token}&access_token={token}"))

print("\n=== 2. Phone 1426657943854134 ===")
print(get(f"{apiUrl}/1426657943854134?fields=id,verified_name,display_phone_number,quality_rating"))

print("\n=== 3. WABA 1116030660847995 ===")
print(get(f"{apiUrl}/1116030660847995?fields=id,name,message_template_namespace"))

print("\n=== 4. Templates in 1116030660847995 ===")
print(get(f"{apiUrl}/1116030660847995/message_templates?limit=10"))

print("\n=== 5. Assigned WABAs ===")
print(get(f"{apiUrl}/122098315461480049/assigned_whatsapp_business_accounts"))
