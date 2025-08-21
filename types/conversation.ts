// Conversation tracking types for maintaining context across interactions

export interface ConversationMessage {
  id: string;
  role: &apos;user&apos; | &apos;assistant&apos;;
  content: string;
  timestamp: number;
  metadata?: {
    editedFiles?: string[]; // Files edited in this interaction
    addedPackages?: string[]; // Packages added in this interaction
    editType?: string; // Type of edit performed
    sandboxId?: string; // Sandbox ID at time of message
  };
}

export interface ConversationEdit {
  timestamp: number;
  userRequest: string;
  editType: string;
  targetFiles: string[];
  confidence: number;
  outcome: &apos;success&apos; | &apos;partial&apos; | &apos;failed&apos;;
  errorMessage?: string;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  edits: ConversationEdit[];
  currentTopic?: string; // Current focus area (e.g., &quot;header styling&quot;, &quot;hero section&quot;)
  projectEvolution: {
    initialState?: string; // Description of initial project state
    majorChanges: Array&amp;lt;{
      timestamp: number;
      description: string;
      filesAffected: string[];
    }&amp;gt;;
  };
  userPreferences: {
    editStyle?: &apos;targeted&apos; | &apos;comprehensive&apos;; // How the user prefers edits
    commonRequests?: string[]; // Common patterns in user requests
    packagePreferences?: string[]; // Commonly used packages
  };
}

export interface ConversationState {
  conversationId: string;
  startedAt: number;
  lastUpdated: number;
  context: ConversationContext;
}