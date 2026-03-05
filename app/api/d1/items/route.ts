import { NextRequest, NextResponse } from 'next/server';
import { getAllItems, createItem, updateItem, deleteItem, getItemById } from '@/lib/cloudflare-d1';

export const runtime = 'edge';

// Allowlist of safe table names to prevent SQL injection
const ALLOWED_TABLES = ['test_items'];

// GET all items
export async function GET(request: NextRequest) {
  try {
    const items = await getAllItems();
    
    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch items',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST create new item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table = 'test_items', name, description } = body;
    
    // Validate table name to prevent SQL injection
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { success: false, error: 'Invalid table', statusCode: 400 },
        { status: 400 }
      );
    }
    
    // Validate column names to prevent SQL injection
    const columnRegex = /^[a-zA-Z0-9_]+$/;
    for (const key of Object.keys(body)) {
      if (!columnRegex.test(key)) {
        return NextResponse.json(
          { success: false, error: 'Invalid column name', statusCode: 400 },
          { status: 400 }
        );
      }
    }
    
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
  } catch (error) {
    console.error('Error creating item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to create item',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT update item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { table = 'test_items', id, name, description } = body;
    
    // Validate table name to prevent SQL injection
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { success: false, error: 'Invalid table', statusCode: 400 },
        { status: 400 }
      );
    }
    
    // Validate column names to prevent SQL injection
    const columnRegex = /^[a-zA-Z0-9_]+$/;
    for (const key of Object.keys(body)) {
      if (!columnRegex.test(key)) {
        return NextResponse.json(
          { success: false, error: 'Invalid column name', statusCode: 400 },
          { status: 400 }
        );
      }
    }
    
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
  } catch (error) {
    console.error('Error updating item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to update item',
      error: error instanceof Error ? error.message : 'Unknown error'
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
  } catch (error) {
    console.error('Error deleting item:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to delete item',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}