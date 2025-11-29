import json

try:
    with open('output/links.json', 'r') as f:
        data = json.load(f)
    
    if "data" in data:
        links = data["data"]
    else:
        links = data
        
    for cat, url_list in links.items():
        print(f"{cat}: {len(url_list)} links")
        
except Exception as e:
    print(e)
