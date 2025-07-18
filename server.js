curl -X POST https://whale-backend-5sgq.onrender.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "finalTest777",
    "events": {
      "tokenTransfers": [
        {
          "source": "SuperFakeWallet111",
          "destination": "VaultOfJars999",
          "tokenAmount": "999999999",
          "mint": "BXXkv6zRCzUVtpKzLZqYU8djDNBm6JjHoBeX6xBKUWsp"
        }
      ]
    }
  }'
