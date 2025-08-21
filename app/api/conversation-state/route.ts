export const dynamic = &quot;force-static&quot;;


import { NextRequest, NextResponse } from &apos;next/server&apos;;
import type { ConversationState } from &apos;@/types/conversation&apos;;

declare global {
  var conversationState: ConversationState | null;
}

// GET: Retrieve current conversation state
export async function GET() {
  try {
    if (!global.conversationState) {
      return NextResponse.json({
        success: true,
        state: null,
        message: &apos;No active conversation&apos;
      });
    }
    
    return NextResponse.json({
      success: true,
      state: global.conversationState
    });
  } catch (error) {
    console.error(&apos;[conversation-state] Error getting state:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// POST: Reset or update conversation state
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    
    switch (action) {
      case &apos;reset&apos;:
        global.conversationState = {
          conversationId: `conv-${Date.now()}`,
          startedAt: Date.now(),
          lastUpdated: Date.now(),
          context: {
            messages: [],
            edits: [],
            projectEvolution: { majorChanges: [] },
            userPreferences: {}
          }
        };
        
        console.log(&apos;[conversation-state] Reset conversation state&apos;);
        
        return NextResponse.json({
          success: true,
          message: &apos;Conversation state reset&apos;,
          state: global.conversationState
        });
        
      case &apos;clear-old&apos;:
        // Clear old conversation data but keep recent context
        if (!global.conversationState) {
          return NextResponse.json({
            success: false,
            error: &apos;No active conversation to clear&apos;
          }, { status: 400 });
        }
        
        // Keep only recent data
        global.conversationState.context.messages = global.conversationState.context.messages.slice(-5);
        global.conversationState.context.edits = global.conversationState.context.edits.slice(-3);
        global.conversationState.context.projectEvolution.majorChanges = 
          global.conversationState.context.projectEvolution.majorChanges.slice(-2);
        
        console.log(&apos;[conversation-state] Cleared old conversation data&apos;);
        
        return NextResponse.json({
          success: true,
          message: &apos;Old conversation data cleared&apos;,
          state: global.conversationState
        });
        
      case &apos;update&apos;:
        if (!global.conversationState) {
          return NextResponse.json({
            success: false,
            error: &apos;No active conversation to update&apos;
          }, { status: 400 });
        }
        
        // Update specific fields if provided
        if (data) {
          if (data.currentTopic) {
            global.conversationState.context.currentTopic = data.currentTopic;
          }
          if (data.userPreferences) {
            global.conversationState.context.userPreferences = {
              ...global.conversationState.context.userPreferences,
              ...data.userPreferences
            };
          }
          
          global.conversationState.lastUpdated = Date.now();
        }
        
        return NextResponse.json({
          success: true,
          message: &apos;Conversation state updated&apos;,
          state: global.conversationState
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: &apos;Invalid action. Use &quot;reset&quot; or &quot;update&quot;&apos;
        }, { status: 400 });
    }
  } catch (error) {
    console.error(&apos;[conversation-state] Error:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// DELETE: Clear conversation state
export async function DELETE() {
  try {
    global.conversationState = null;
    
    console.log(&apos;[conversation-state] Cleared conversation state&apos;);
    
    return NextResponse.json({
      success: true,
      message: &apos;Conversation state cleared&apos;
    });
  } catch (error) {
    console.error(&apos;[conversation-state] Error clearing state:&apos;, error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}