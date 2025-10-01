import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to like songs' },
        { status: 401 }
      );
    }

    const { songId } = params;

    // Check if already liked
    const existing = await prisma.userSongLike.findUnique({
      where: {
        userId_songId: {
          userId: session.user.id,
          songId: songId
        }
      }
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        message: 'Song already liked'
      });
    }

    // Create like
    await prisma.userSongLike.create({
      data: {
        userId: session.user.id,
        songId: songId
      }
    });

    // Update song like count
    await prisma.song.update({
      where: { id: songId },
      data: { totalLikes: { increment: 1 } }
    });

    return NextResponse.json({
      success: true,
      message: 'Song liked'
    });

  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to like song' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in' },
        { status: 401 }
      );
    }

    const { songId } = params;

    // Remove like
    await prisma.userSongLike.delete({
      where: {
        userId_songId: {
          userId: session.user.id,
          songId: songId
        }
      }
    });

    // Update song like count
    await prisma.song.update({
      where: { id: songId },
      data: { totalLikes: { decrement: 1 } }
    });

    return NextResponse.json({
      success: true,
      message: 'Song unliked'
    });

  } catch (error) {
    console.error('Unlike error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlike song' },
      { status: 500 }
    );
  }
}
