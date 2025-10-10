const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixImages() {
  // Use the correct single image URL for Luv Is Rage 2
  const correctImageUrl = 'https://i.scdn.co/image/ab67616d0000b273d7e1c68ed8e464b03095afda';

  // Update all Luv Is Rage 2 songs (both with null and broken URLs)
  const result = await prisma.song.updateMany({
    where: {
      album: 'Luv Is Rage 2'
    },
    data: {
      imageUrl: correctImageUrl
    }
  });

  console.log(`Updated ${result.count} songs with correct image`);
}

fixImages()
  .then(() => prisma.$disconnect())
  .catch(console.error);
