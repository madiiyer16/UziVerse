import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const search = searchParams.get('search') || '';

    // Get all songs with their albums
    let songs = await prisma.song.findMany({
      where: {
        album: { not: null },
        ...(search && {
          OR: [
            { album: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      select: {
        album: true,
        year: true,
        releaseType: true,
        imageUrl: true,
        spotifyId: true
      }
    });

    // Group albums manually, prioritizing songs with images
    const albumMap = new Map();
    songs.forEach(song => {
      if (!albumMap.has(song.album)) {
        albumMap.set(song.album, {
          name: song.album,
          year: song.year,
          releaseType: song.releaseType,
          trackCount: 1,
          imageUrl: song.imageUrl,
          spotifyId: song.spotifyId
        });
      } else {
        const album = albumMap.get(song.album);
        album.trackCount++;
        // Update image if current song has one and album doesn't
        if (song.imageUrl && !album.imageUrl) {
          album.imageUrl = song.imageUrl;
          album.spotifyId = song.spotifyId;
        }
      }
    });

    // Convert to array and filter by type
    let albums = Array.from(albumMap.values());
    
    if (type === 'albums') {
      albums = albums.filter(a => a.releaseType === 'ALBUM');
    } else if (type === 'singles') {
      albums = albums.filter(a => a.releaseType === 'SINGLE');
    }

    // Sort by year descending
    albums.sort((a, b) => b.year - a.year);

    return NextResponse.json({
      success: true,
      albums
    });

  } catch (error) {
    console.error('Albums API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch albums', details: error.message },
      { status: 500 }
    );
  }
}
