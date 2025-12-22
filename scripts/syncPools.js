const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

async function syncPools() {
  try {
    console.log('Fetching pools from Geopunt API...');

    // Fetch indoor and outdoor pools in parallel
    const [indoorResponse, outdoorResponse] = await Promise.all([
      fetch('https://www.geopunt.be/bff/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poiType: 'OverdektZwembad',
          crs: 31370,
          maxCount: 1000,
          spatialRel: 'envelopeintersects',
          bbox: null,
          clustering: false
        })
      }),
      fetch('https://www.geopunt.be/bff/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poiType: 'OpenluchtZwembad',
          crs: 31370,
          maxCount: 1000,
          spatialRel: 'envelopeintersects',
          bbox: null,
          clustering: false
        })
      })
    ]);

    const indoorData = await indoorResponse.json();
    const outdoorData = await outdoorResponse.json();

    const indoorPools = indoorData.result?.pois || [];
    const outdoorPools = outdoorData.result?.pois || [];

    console.log(`Found ${indoorPools.length} indoor pools and ${outdoorPools.length} outdoor pools`);

    // Combine all pools
    const allPools = [
      ...indoorPools.map(p => ({ ...p, isIndoor: true })),
      ...outdoorPools.map(p => ({ ...p, isIndoor: false }))
    ];

    console.log('Fetching detailed data for each pool...');

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < allPools.length; i++) {
      const poi = allPools[i];
      
      try {
        // Fetch individual pool details to get full address
        const detailResponse = await fetch(`https://poi.api.geopunt.be/v1/core?id=${poi.id}&maxmodel=true`);
        const detailData = await detailResponse.json();
        const poolDetail = detailData.pois?.[0] || poi;

        const poolData = {
          id: poi.id,
          name: poolDetail.labels?.find(l => l.term === 'primary')?.value || 'Unknown',
          description: `Swimming pool in ${poolDetail.location?.address?.municipality || 'Unknown'}`,
          address: poolDetail.location?.address 
            ? `${poolDetail.location.address.street || ''} ${poolDetail.location.address.streetnumber || ''}`.trim()
            : 'Unknown',
          city: poolDetail.location?.address?.municipality || 'Unknown',
          latitude: poolDetail.location?.points?.[0]?.Point?.coordinates?.[1] || 0,
          longitude: poolDetail.location?.points?.[0]?.Point?.coordinates?.[0] || 0,
          poolType: poi.isIndoor ? 'Indoor' : 'Outdoor',
          isIndoor: poi.isIndoor,
          facilities: null,
          imageUrl: null,
          openingTime: '09:00',
          closingTime: '17:00',
          capacity: 50
        };

        // Upsert: create if doesn't exist, update if exists
        await prisma.pool.upsert({
          where: { id: poi.id },
          update: poolData,
          create: poolData
        });

        inserted++;
        
        // Progress indicator
        if ((i + 1) % 20 === 0) {
          console.log(`   Processed ${i + 1}/${allPools.length} pools...`);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error inserting pool ${poi.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n✅ Sync completed!');
    console.log(`   Processed: ${inserted} pools`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total in database: ${await prisma.pool.count()}`);

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncPools();
