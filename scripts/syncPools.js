const { PrismaClient } = require('../generated/prisma');
const proj4 = require('proj4');
const prisma = new PrismaClient();

// Define Lambert 31370 (Belgian Lambert) projection
const lambert31370 = '+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs';
const wgs84 = 'EPSG:4326';

// Function to convert Lambert to lat/lng
function lambertToLatLng(x, y) {
  const [lng, lat] = proj4(lambert31370, wgs84, [x, y]);
  return { lat, lng };
}

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

    // Combine
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

        // Get Lambert coordinates
        const lambertX = poolDetail.location?.points?.[0]?.Point?.coordinates?.[0] || 0;
        const lambertY = poolDetail.location?.points?.[0]?.Point?.coordinates?.[1] || 0;
        
        // Convert to WGS84 lat/lng for map display
        const { lat, lng } = lambertToLatLng(lambertX, lambertY);

        const poolData = {
          id: poi.id,
          name: poolDetail.labels?.find(l => l.term === 'primary')?.value || 'Unknown',
          description: `Swimming pool in ${poolDetail.location?.address?.municipality || 'Unknown'}`,
          address: poolDetail.location?.address 
            ? `${poolDetail.location.address.street || ''} ${poolDetail.location.address.streetnumber || ''}`.trim()
            : 'Unknown',
          city: poolDetail.location?.address?.municipality || 'Unknown',
          latitude: lat,  
          longitude: lng, 
          poolType: poi.isIndoor ? 'Indoor' : 'Outdoor',
          isIndoor: poi.isIndoor,
          facilities: null,
          imageUrl: null,
          openingTime: '09:00',
          closingTime: '17:00',
          capacity: 50
        };


        await prisma.pool.upsert({
          where: { id: poi.id },
          update: poolData,
          create: poolData
        });

        inserted++;
        
        if ((i + 1) % 20 === 0) {
          console.log(`   Processed ${i + 1}/${allPools.length} pools...`);
        }
        
        // Small delay 
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error inserting pool ${poi.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n Sync completed!');
    console.log(`   Processed: ${inserted} pools`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total in database: ${await prisma.pool.count()}`);

  } catch (error) {
    console.error('Sync failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

//run
syncPools();
