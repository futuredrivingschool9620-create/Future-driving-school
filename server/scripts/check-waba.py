import urllib.request, json

token = "EAAUurdeulKcBSWjSZC3SNPCSmaFwz8rr2XsQzb9GW3eBv6eZBMabKjHoF8w1I1PGM33lrw9ZCd6KPC4PBQilzAnCnn49ue8nXDHwIjlZC9YqCdNksOZAyGNfNNFozaDg48ZCEpoAYneWEPRyCUGccPPlHZChn6Ihsejz4EHmOGL3XMSszmA8RzaqOpTEDwGrnS1kwZDZD"
apiUrl = "https://graph.facebook.com/v25.0"
wabaId = "1070350425583234"
businessId = "1546800943437287"

# Check WABA details
print("=== WABA Details ===")
req = urllib.request.Request(
    f"{apiUrl}/{wabaId}?fields=id,name,currency,timezone_id,account_review_status,business_verification_status,ownership_type",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read().decode("utf-8")), indent=2))
except urllib.error.HTTPError as e:
    print(f"Error: {e.read().decode('utf-8')}")

# Check business verification
print("\n=== Business Details ===")
req = urllib.request.Request(
    f"{apiUrl}/{businessId}?fields=id,name,verification_status,is_disabled_for_integrity",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read().decode("utf-8")), indent=2))
except urllib.error.HTTPError as e:
    print(f"Error: {e.read().decode('utf-8')}")

# Check phone number messaging limit
print("\n=== Phone Details ===")
req = urllib.request.Request(
    f"{apiUrl}/1337951776062823?fields=id,verified_name,display_phone_number,status,quality_rating,messaging_limit_tier,is_official_business_account",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read().decode("utf-8")), indent=2))
except urllib.error.HTTPError as e:
    print(f"Error: {e.read().decode('utf-8')}")
