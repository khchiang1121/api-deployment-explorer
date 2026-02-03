const fs = require('fs');

const configPath = './public/config.json';
const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Migrate Environments
data.envs = data.envs.map(env => {
    // Current: name="PRD1", id="Region-01-PRD1"
    // New: displayName="PRD1", name="Region-01-PRD1" (Cluster Name), clusterName="Region-01-PRD1"

    // We want to differentiate "Name" (Filter/Unique) vs "Display" (UI).
    const displayName = env.name;
    const clusterName = env.id; // Or explicitly construct it.

    return {
        ...env,
        name: clusterName, // Replace shared name with unique name
        displayName: displayName // Keep shared name for display
    };
});

// Migrate APIs (Add default scope)
data.apis = data.apis.map(api => {
    return {
        ...api,
        scope: 'CLUSTER' // Default scope
    };
});

// Mark some APIs as REGIONAL (Example logic, can be refined manually later)
// For now, just setting default. User can edit specific ones.

fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
console.log('Migration complete');
