import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'albums', 'singles', 'all'

    // Get unique albums with song counts
    const albums = await prisma.song.groupBy({
      by: ['album', 'year', 'releaseType'],
      where: {
        album: {
          not: null
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        year: 'desc'
      }
    });

    // Filter by type if specified
    const filteredAlbums = type === 'all' ? albums : 
      albums.filter(album => {
        if (type === 'albums') return album.releaseType === 'ALBUM';
        if (type === 'singles') return album.releaseType === 'SINGLE';
        return true;
      });

    // Get album artwork from first song in each album
    const albumsWithArtwork = await Promise.all(
      filteredAlbums.map(async (album) => {
        const firstSong = await prisma.song.findFirst({
          where: { album: album.album },
          select: { imageUrl: true, spotifyId: true }
        });

        return {
          name: album.album,
          year: album.year,
          releaseType: album.releaseType,
          trackCount: album._count.id,
          imageUrl: firstSong?.imageUrl,
          spotifyId: firstSong?.spotifyId
        };
      })
    );

    return NextResponse.json({
      success: true,
      albums: albumsWithArtwork
    });

  } catch (error) {
    console.error('Albums API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch albums' },
      { status: 500 }
    );
  }
}
