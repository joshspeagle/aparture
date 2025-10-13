// cli/test-config.js
// Quick test script for ConfigManager

const { ConfigManager } = require('./config-manager');

async function testConfigManager() {
    console.log('Testing ConfigManager...\n');

    const manager = new ConfigManager();
    await manager.init();

    try {
        // Test 1: Save a config
        console.log('Test 1: Saving config...');
        const testConfig = {
            categories: ['cs.AI', 'cs.CV'],
            scoringCriteria: 'Computer vision papers',
            daysBack: 14,
            filterModel: 'claude-3.5-haiku',
            scoringModel: 'claude-sonnet-4.5'
        };
        await manager.save('test-config', testConfig);
        console.log('✓ Config saved successfully\n');

        // Test 2: Load the config
        console.log('Test 2: Loading config...');
        const loaded = await manager.load('test-config');
        console.log('✓ Config loaded:', {
            categories: loaded.categories,
            criteria: loaded.scoringCriteria.substring(0, 30) + '...'
        });
        console.log();

        // Test 3: List all configs
        console.log('Test 3: Listing all configs...');
        const list = await manager.list();
        console.log('✓ Available configs:', list);
        console.log();

        // Test 4: Set active config
        console.log('Test 4: Setting active config...');
        await manager.setActive('test-config');
        const active = await manager.getActive();
        console.log('✓ Active config:', active.name);
        console.log();

        // Test 5: Get config (should return active)
        console.log('Test 5: Getting config (should use active)...');
        const config = await manager.getConfig(null);
        console.log('✓ Retrieved config with categories:', config.categories);
        console.log();

        // Test 6: Validate config
        console.log('Test 6: Validating config...');
        const errors = manager.validate(testConfig);
        if (errors.length === 0) {
            console.log('✓ Config is valid');
        } else {
            console.log('✗ Validation errors:', errors);
        }
        console.log();

        // Test 7: Validate invalid config
        console.log('Test 7: Validating invalid config...');
        const invalidConfig = {
            categories: [],
            scoringCriteria: '',
            daysBack: -1
        };
        const invalidErrors = manager.validate(invalidConfig);
        console.log('✓ Caught', invalidErrors.length, 'validation errors:');
        invalidErrors.forEach(err => console.log('  -', err));
        console.log();

        // Test 8: Merge with defaults
        console.log('Test 8: Merging partial config with defaults...');
        const partial = { categories: ['cs.LG'], daysBack: 3 };
        const merged = manager.mergeWithDefaults(partial);
        console.log('✓ Merged config has', Object.keys(merged).length, 'keys');
        console.log('  Categories:', merged.categories);
        console.log('  Days back:', merged.daysBack);
        console.log('  Filter model (from default):', merged.filterModel);
        console.log();

        console.log('All tests passed! ✓');
        return true;
    } catch (error) {
        console.error('Test failed:', error.message);
        return false;
    }
}

// Run tests if executed directly
if (require.main === module) {
    testConfigManager()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { testConfigManager };
