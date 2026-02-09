import json

regions = [f"R{i}" for i in range(1, 11)]
types = ["DEV", "TEST", "STG", "PRD"]

data = []

for idx, region in enumerate(regions):
    env = types[idx % 4]
    env_lower = env.lower()

    for c in range(1, 21):
        cluster_type = "Gen1" if c <= 10 else "Gen2"
        name = f"C{c}"

        data.append({
            "region": region,
            "name": name,
            "type": env,
            "urlPattern": f"https://{{api}}.{name.lower()}.{env_lower}.example.com",
            "displayName": name,
            "regionalUrlPattern": f"https://{{api}}.{env_lower}.example.com",
            "clusterType": cluster_type
        })

print(json.dumps(data, indent=2))

# export to file
with open('env.json', 'w') as f:
    json.dump(data, f, indent=2)