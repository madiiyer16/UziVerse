// app/api/songs/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Build where clause
    const whereClause = search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { album: { contains: search, mode: 'insensitive' } },
        { artist: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    // Fetch songs with genres, moods, and likes
    const songs = await prisma.song.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      include: {
        genres: {
          include: {
            genre: true
          }
        },
        moods: {
          include: {
            mood: true
          }
        },
        likes: session?.user?.id ? {
          where: {
            userId: session.user.id
          }
        } : false,
        ratings: {
          select: {
            rating: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                username: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.song.count({ where: whereClause });

    // Transform the data to match frontend expectations
    const transformedSongs = songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      imageUrl: song.imageUrl,
      spotifyUrl: song.spotifyUrl,
      youtubeUrl: song.youtubeUrl,
      duration: song.duration,
      
      // Extract genre names from the relationship
      genre: song.genres?.map(sg => sg.genre.name) || [],
      
      // Extract mood names from the relationship
      mood: song.moods?.map(sm => sm.mood.name) || [],
      
      // Audio features - make sure they're included
      audioFeatures: {
        energy: song.energy || 0,
        danceability: song.danceability || 0,
        valence: song.valence || 0,
        tempo: song.tempo || 0,
        loudness: song.loudness || 0,
        speechiness: song.speechiness || 0,
        acousticness: song.acousticness || 0,
        instrumentalness: song.instrumentalness || 0,
        liveness: song.liveness || 0
      },
      
      // Also add them at root level for backwards compatibility
      energy: song.energy || 0,
      danceability: song.danceability || 0,
      valence: song.valence || 0,
      tempo: song.tempo || 0,
      
      // Ratings - calculate from Rating model if avgRating is not set
      avgRating: song.avgRating || (song.ratings?.length > 0 
        ? song.ratings.reduce((sum, r) => sum + r.rating, 0) / song.ratings.length 
        : 0),
      totalRatings: song.totalRatings || song.ratings?.length || 0,
      
      // Like status for current user
      isLiked: session?.user?.id ? (song.likes?.length > 0) : false,
      
      // Reviews
      reviews: song.reviews?.map(review => ({
        id: review.id,
        username: review.user?.username || 'Anonymous',
        rating: review.rating,
        review: review.reviewText,
        comment: review.reviewText,
        date: review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''
      })) || []
    }));

    return NextResponse.json({
      success: true,
      songs: transformedSongs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching songs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch songs' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
