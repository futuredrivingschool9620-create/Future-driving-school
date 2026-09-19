import urllib.request, json

token = "EAAUurdeulKcBSWjSZC3SNPCSmaFwz8rr2XsQzb9GW3eBv6eZBMabKjHoF8w1I1PGM33lrw9ZCd6KPC4PBQilzAnCnn49ue8nXDHwIjlZC9YqCdNksOZAyGNfNNFozaDg48ZCEpoAYneWEPRyCUGccPPlHZChn6Ihsejz4EHmOGL3XMSszmA8RzaqOpTEDwGrnS1kwZDZD"
apiUrl = "https://graph.facebook.com/v25.0"
wabaId = "1070350425583234"

# Try creating future_driving_school in en_US (the other one was en)
payload = {
    "name": "future_driving_school",
    "category": "UTILITY",
    "language": "en_US",
    "components": [
        {
            "type": "BODY",
            "text": "Dear {{1}},\nThis is a reminder regarding your vehicle {{2}}.\nDocument: {{3}}\nExpiry Date: {{4}}\nDays Remaining: {{5}}\nPlease arrange for renewal before the expiry date.\nFor assistance, contact Future Driving School.",
            "example": {
                "body_text": [["Rahul Kumar", "KA09AB1234", "Insurance", "20 Sep 2026", "15"]]
            }
        }
    ]
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    f"{apiUrl}/{wabaId}/message_templates",
    data=data,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print("SUCCESS:", json.dumps(result, indent=2, ensure_ascii=True))
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")

# Check all
print("\n--- All Templates ---")
req = urllib.request.Request(
    f"{apiUrl}/{wabaId}/message_templates?limit=10",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    for t in data.get("data", []):
        print(f"  {t.get('name')} | lang={t.get('language')} | status={t.get('status')} | id={t.get('id')}")
