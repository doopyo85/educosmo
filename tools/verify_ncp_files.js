
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env explicitly
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const s3Client = new S3Client({
    region: 'ap-northeast-2',
    endpoint: 'https://kr.object.ncloudstorage.com', // NCP endpoint
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function checkFiles() {
    try {
        console.log('Checking S3 bucket...');
        const bucket = process.env.BUCKET_NAME || 'educodingnplaycontents';

        console.log(`Listing objects in ${bucket} prefix 'cos/'...`);

        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: 'cos/'
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            console.log(`Found ${response.Contents.length} files in 'cos/'.`);
            const pngs = response.Contents.filter(c => c.Key.endsWith('.png'));
            console.log(`Found ${pngs.length} PNGs.`);
            if (pngs.length > 0) {
                console.log('Sample PNGs:');
                pngs.slice(0, 5).forEach(c => console.log(c.Key));
            }

            const target = response.Contents.find(c => c.Key.includes('cos1-1s-01p'));
            if (target) {
                console.log('FOUND TARGET:', target.Key);
            } else {
                console.log('Target cos1-1s-01p not found in cos/');
            }
        } else {
            console.log('No files found in cos/.');
        }

        console.log(`Listing obects in ${bucket} prefix 'scratch/'...`);
        const command2 = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: 'scratch/'
        });
        const response2 = await s3Client.send(command2);
        if (response2.Contents) {
            const matches = response2.Contents.filter(c => c.Key.toLowerCase().includes('cos'));
            console.log(`Found ${matches.length} matching 'cos' in scratch/:`);
            matches.slice(0, 20).forEach(c => console.log(c.Key));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

checkFiles();
