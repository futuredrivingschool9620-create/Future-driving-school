import urllib.request, json

token = "EAAUurdeulKcBSWjSZC3SNPCSmaFwz8rr2XsQzb9GW3eBv6eZBMabKjHoF8w1I1PGM33lrw9ZCd6KPC4PBQilzAnCnn49ue8nXDHwIjlZC9YqCdNksOZAyGNfNNFozaDg48ZCEpoAYneWEPRyCUGccPPlHZChn6Ihsejz4EHmOGL3XMSszmA8RzaqOpTEDwGrnS1kwZDZD"
apiUrl = "https://graph.facebook.com/v25.0"
wabaId = "1070350425583234"

req = urllib.request.Request(
    f"{apiUrl}/{wabaId}/message_templates?limit=20",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    print(f"Total templates in WABA {wabaId}: {len(data.get('data', []))}")
    for t in data.get("data", []):
        print(f"  {t.get('name')} | lang={t.get('language')} | status={t.get('status')} | cat={t.get('category')} | id={t.get('id')}")
