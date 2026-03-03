import { NextRequest, NextResponse } from 'next/server';
import { getAllItems, createItem, updateItem, deleteItem, getItemById } from '@/lib/cloudflare-d1';

export const runtime = 'edge';

// GET all items
export async function GET(request: NextRequest) {
  try {
    const items = await getAllItems();
    
    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error: any) {
    console.error('Error fetching items:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch items',
      error: error.message
    }, { status: 500 });
  }
}

// POST create new item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    if (!name) {
      return NextResponse.json({
        success: false,
        message: 'Name is required'
      }, { status: 400 });
    }
    
    const item = await createItem(name, description || '');
    
    if (!item) {
      return NextResponse.json({
        success: false,
        message: 'Failed to create item'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
  } catch (error: any) {
    console.error('Error creating item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to create item',
      error: error.message
    }, { status: 500 });
  }
}

// PUT update item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description } = body;
    
    if (!id || !name) {
      return NextResponse.json({
        success: false,
        message: 'ID and name are required'
      }, { status: 400 });
    }
    
    const item = await updateItem(id, name, description || '');
    
    if (!item) {
      return NextResponse.json({
        success: false,
        message: 'Failed to update item'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error: any) {
    console.error('Error updating item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to update item',
      error: error.message
    }, { status: 500 });
  }
}

// DELETE item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'ID is required'
      }, { status: 400 });
    }
    
    const success = await deleteItem(parseInt(id));
    
    if (!success) {
      return NextResponse.json({
        success: false,
        message: 'Failed to delete item'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to delete item',
      error: error.message
    }, { status: 500 });
  }
}