import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { createDemoData } from "./demo-data.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ========== AUTH HELPERS ==========

/**
 * Get user from access token
 * Decodes JWT to extract user ID, then fetches user data
 */
async function getUserFromToken(accessToken: string) {
  try {
    // Decode JWT token to get user ID (JWT format: header.payload.signature)
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      console.error('❌ getUserFromToken: Invalid token format');
      return { user: null, error: new Error('Invalid token format') };
    }
    
    // Decode payload (base64url)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = payload.sub;
    
    if (!userId) {
      console.error('❌ getUserFromToken: No user ID in token');
      return { user: null, error: new Error('No user ID in token') };
    }
    
    // Get user data using admin API
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error) {
      console.error('❌ getUserFromToken error:', error.message);
      return { user: null, error };
    }
    
    if (!user) {
      console.error('❌ getUserFromToken: User not found');
      return { user: null, error: new Error('User not found') };
    }
    
    console.log(`✅ getUserFromToken: User verified - ${user.email} (${user.id})`);
    return { user, error: null };
  } catch (error) {
    console.error('❌ getUserFromToken exception:', error);
    return { user: null, error };
  }
}

// ========== PERMISSION HELPERS ==========

/**
 * Get user's role in a project
 * Returns: 'owner' | 'admin' | 'member' | 'viewer' | null
 */
function getUserRoleInProject(project: any, userId: string, userEmail?: string): string | null {
  if (!project) {
    console.log(`  🔍 getUserRoleInProject: No project provided`);
    return null;
  }
  
  console.log(`  🔍 getUserRoleInProject: Checking role for user ${userEmail} (${userId}) in project ${project.name} (${project.id})`);
  console.log(`     Project owner: ${project.userId}`);
  
  // Check if user is project owner
  if (project.userId === userId) {
    console.log(`     ✅ User is owner`);
    return 'owner';
  }
  
  // Check members list
  if (project.members && Array.isArray(project.members)) {
    console.log(`     Project has ${project.members.length} members:`, project.members.map((m: any) => ({ userId: m.userId, email: m.email, role: m.role })));
    
    const member = project.members.find((m: any) => {
      // Match by userId (for registered members)
      if (m.userId === userId) {
        console.log(`     ✅ Found member by userId: ${m.userId}, role: ${m.role || 'member'}`);
        return true;
      }
      // Match by email (for invited members who may not be registered yet)
      if (userEmail && m.email === userEmail) {
        console.log(`     ✅ Found member by email: ${m.email}, role: ${m.role || 'member'}`);
        return true;
      }
      return false;
    });
    
    if (member) {
      return member.role || 'member'; // Default to 'member' if role not specified
    }
  } else {
    console.log(`     Project has no members array`);
  }
  
  console.log(`     ❌ User is not a member of this project`);
  return null;
}

/**
 * Check if user can view all tasks in project
 * Owner, Collaborator, Viewer - can view all tasks
 * Member - can only view assigned tasks
 */
function canViewAllProjectTasks(role: string | null): boolean {
  const canView = role === 'owner' || role === 'collaborator' || role === 'viewer';
  console.log(`    🔐 canViewAllProjectTasks: role=${role}, canView=${canView}`);
  return canView;
}

/**
 * Check if user can edit task
 * Owner, Collaborator - can edit any task
 * Member - can edit assigned tasks OR tasks created by them
 * Viewer - cannot edit
 */
function canEditTask(role: string | null, task: any, userId: string): boolean {
  if (role === 'owner' || role === 'collaborator') {
    return true;
  }
  
  if (role === 'member') {
    // Member can edit task if they are assigned to it OR created it
    return task.assigneeId === userId || task.createdBy === userId;
  }
  
  return false; // Viewer cannot edit
}

/**
 * Check if user can create task in project
 * Owner, Collaborator, Member - can create tasks
 * Viewer - cannot create
 */
function canCreateTask(role: string | null): boolean {
  return role === 'owner' || role === 'collaborator' || role === 'member';
}

/**
 * Check if user can edit project
 * Owner, Collaborator - can edit project
 * Member, Viewer - cannot edit project
 */
function canEditProject(role: string | null): boolean {
  return role === 'owner' || role === 'collaborator';
}

/**
 * Check if user can delete project
 * Only Owner can delete project
 */
function canDeleteProject(role: string | null): boolean {
  return role === 'owner';
}

// Create avatars and task attachments buckets on startup
async function initializeStorage() {
  try {
    const buckets = [
      { name: 'make-d9879966-avatars', sizeLimit: 2097152 }, // 2MB
      { name: 'make-d9879966-task-files', sizeLimit: 10485760 }, // 10MB
    ];

    const { data: existingBuckets } = await supabase.storage.listBuckets();
    
    for (const bucket of buckets) {
      const bucketExists = existingBuckets?.some(b => b.name === bucket.name);
      
      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket(bucket.name, {
          public: false,
          fileSizeLimit: bucket.sizeLimit,
        });
        
        // Ignore "already exists" errors (409 status)
        if (error && error.statusCode !== '409') {
          console.error(`Error creating ${bucket.name} bucket:`, error);
        } else if (error && error.statusCode === '409') {
          console.log(`✅ ${bucket.name} bucket already exists (409)`);
        } else {
          console.log(`✅ ${bucket.name} bucket created successfully`);
        }
      } else {
        console.log(`✅ ${bucket.name} bucket already exists`);
      }
    }
  } catch (error) {
    console.error('Storage initialization error:', error);
  }
}

// Initialize storage on startup
initializeStorage();

// Health check endpoint
app.get("/make-server-d9879966/health", (c) => {
  return c.json({ status: "ok" });
});

// ========== TASKS ROUTES ==========

// Get all tasks for user
app.get("/make-server-d9879966/tasks", async (c) => {
  console.log('🔍 GET /tasks - Request received');
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      console.log('❌ GET /tasks - No access token provided');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('✅ GET /tasks - Access token found, verifying user...');
    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      console.error('❌ GET /tasks - Auth error:', error);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`✅ GET /tasks - User authenticated: ${user.email} (${user.id})`);

    // Get user's personal tasks
    const personalTasks = await kv.getByPrefix(`task:user:${user.id}:`) || [];
    console.log(`📋 User ${user.email} has ${personalTasks.length} personal tasks`);
    
    // Get all projects to find which ones user has access to
    const allProjects = await kv.getByPrefix(`project:user:`) || [];
    console.log(`📁 Total projects in system: ${allProjects.length}`);
    
    const userProjects = allProjects.filter((project: any) => {
      console.log(`  🔍 Checking access to project: ${project.name} (${project.id})`);
      console.log(`     Project owner: ${project.userId}, Current user: ${user.id}`);
      
      // User is owner
      if (project.userId === user.id) {
        console.log(`  ✅ User is owner of project: ${project.name} (${project.id})`);
        return true;
      }
      
      // User is a member
      if (project.members && Array.isArray(project.members)) {
        console.log(`     Project has ${project.members.length} members:`, project.members.map((m: any) => ({ userId: m.userId, email: m.email, role: m.role })));
        console.log(`     Looking for userId: ${user.id} or email: ${user.email}`);
        
        const isMember = project.members.some((member: any) => {
          const matchById = member.userId === user.id;
          const matchByEmail = member.email === user.email;
          console.log(`       Checking member userId: ${member.userId}, email: ${member.email}, matchById: ${matchById}, matchByEmail: ${matchByEmail}`);
          return matchById || matchByEmail;
        });
        
        if (isMember) {
          console.log(`  ✅ User is member of project: ${project.name} (${project.id})`);
          return true;
        } else {
          console.log(`  ❌ User is NOT a member of project: ${project.name} (${project.id})`);
        }
      } else {
        console.log(`     Project has no members`);
      }
      return false;
    });
    
    console.log(`📁 User has access to ${userProjects.length} projects`);
    
    // Get tasks from all user's projects with permission filtering
    const projectTasks: any[] = [];
    for (const project of userProjects) {
      const allProjectTasks = await kv.getByPrefix(`task:project:${project.id}:`) || [];
      const userRole = getUserRoleInProject(project, user.id, user.email);
      
      console.log(`  📋 Project "${project.name}" (${project.id}): ${allProjectTasks.length} tasks, user role: ${userRole}`);
      
      // Filter tasks based on user's role
      let filteredTasks = allProjectTasks;
      if (!canViewAllProjectTasks(userRole)) {
        // Member can only see tasks assigned to them OR created by them
        console.log(`    🔒 Member role detected. Current user ID: ${user.id}, email: ${user.email}`);
        console.log(`    🔍 All project tasks:`, allProjectTasks.map((t: any) => ({ 
          id: t.id, 
          title: t.title, 
          assigneeId: t.assigneeId,
          createdBy: t.createdBy,
          isAssigned: t.assigneeId === user.id,
          isAuthor: t.createdBy === user.id 
        })));
        
        filteredTasks = allProjectTasks.filter((task: any) => 
          task.assigneeId === user.id || task.createdBy === user.id
        );
        console.log(`    🔒 Member role: showing ${filteredTasks.length} tasks out of ${allProjectTasks.length} total (assigned or created by user)`);
      } else {
        console.log(`    ✅ Full access: showing all ${filteredTasks.length} tasks`);
      }
      
      if (filteredTasks.length > 0) {
        console.log(`    Task IDs: ${filteredTasks.map((t: any) => t.id).join(', ')}`);
      }
      
      projectTasks.push(...filteredTasks);
    }
    
    // Deduplicate tasks by ID (in case task exists in both personal and project)
    const tasksMap = new Map();
    
    // Add personal tasks first
    for (const task of personalTasks) {
      tasksMap.set(task.id, task);
    }
    
    // Add project tasks (will override if duplicate)
    for (const task of projectTasks) {
      tasksMap.set(task.id, task);
    }
    
    const allTasks = Array.from(tasksMap.values());
    const duplicatesRemoved = (personalTasks.length + projectTasks.length) - allTasks.length;
    
    if (duplicatesRemoved > 0) {
      console.log(`⚠️ Removed ${duplicatesRemoved} duplicate tasks (original: ${personalTasks.length + projectTasks.length}, deduplicated: ${allTasks.length})`);
    }
    
    console.log(`✅ Total tasks for user ${user.email}: ${allTasks.length} (${personalTasks.length} personal + ${projectTasks.length} project, ${duplicatesRemoved} duplicates removed)`);
    
    return c.json({ tasks: allTasks });
  } catch (error) {
    console.error('❌ Get tasks error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    return c.json({ error: 'Failed to fetch tasks', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Create task
app.post("/make-server-d9879966/tasks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskData = await c.req.json();
    const taskId = crypto.randomUUID();
    
    const task = {
      id: taskId,
      ...taskData,
      userId: user.id,
      createdBy: user.id, // Автор задачи
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log(`📝 Creating task for user ${user.email} (${user.id})`, {
      taskId,
      projectId: taskData.projectId,
      assigneeId: taskData.assigneeId,
      title: taskData.title,
    });

    // Determine storage key based on whether task belongs to a project or is personal
    let storageKey: string;
    if (taskData.projectId) {
      // Verify user has access to this project
      const allProjects = await kv.getByPrefix(`project:user:`) || [];
      const project = allProjects.find((p: any) => p.id === taskData.projectId);
      
      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }
      
      console.log(`  📁 Project found: ${project.name}`, {
        owner: project.userId,
        members: project.members?.map((m: any) => ({ userId: m.userId, email: m.email, role: m.role })) || [],
      });
      
      // Check if user has permission to create tasks in this project
      const userRole = getUserRoleInProject(project, user.id, user.email);
      
      if (!canCreateTask(userRole)) {
        return c.json({ error: 'У вас нет прав для создания задач в этом проекте (только наблюдатель)' }, 403);
      }
      
      // Validate assigneeId if provided
      if (taskData.assigneeId) {
        const isOwner = project.userId === taskData.assigneeId;
        const isMember = project.members?.some((m: any) => m.userId === taskData.assigneeId);
        
        if (!isOwner && !isMember) {
          console.warn(`  ⚠️ Assignee ${taskData.assigneeId} is not a member of project ${project.name}`);
          // Don't fail - allow assigning to any user, but log warning
        } else {
          console.log(`  ✅ Assignee ${taskData.assigneeId} is a valid member of the project`);
        }
      }
      
      storageKey = `task:project:${taskData.projectId}:${taskId}`;
      console.log(`  💾 Creating project task with key: ${storageKey}`);
    } else {
      storageKey = `task:user:${user.id}:${taskId}`;
      console.log(`Creating personal task with key: ${storageKey}`);
    }

    await kv.set(storageKey, task);
    return c.json({ task });
  } catch (error) {
    console.log('Create task error:', error);
    return c.json({ error: 'Failed to create task' }, 500);
  }
});

// Update task
app.put("/make-server-d9879966/tasks/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    const updates = await c.req.json();
    
    // Try to find task in personal tasks first
    let existingTask = await kv.get(`task:user:${user.id}:${taskId}`);
    let storageKey = `task:user:${user.id}:${taskId}`;
    let taskProject = null;
    
    // If not found, search in project tasks
    if (!existingTask) {
      const allProjects = await kv.getByPrefix(`project:user:`) || [];
      const userProjects = allProjects.filter((project: any) => {
        if (project.userId === user.id) return true;
        if (project.members && Array.isArray(project.members)) {
          return project.members.some((member: any) => 
            member.userId === user.id || member.email === user.email
          );
        }
        return false;
      });
      
      for (const project of userProjects) {
        const projectTask = await kv.get(`task:project:${project.id}:${taskId}`);
        if (projectTask) {
          existingTask = projectTask;
          storageKey = `task:project:${project.id}:${taskId}`;
          taskProject = project;
          break;
        }
      }
    }
    
    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Check permissions for project tasks
    if (taskProject) {
      const userRole = getUserRoleInProject(taskProject, user.id, user.email);
      
      if (!canEditTask(userRole, existingTask, user.id)) {
        return c.json({ 
          error: 'У вас нет прав для редактирования этой задачи. Участники могут редактировать только назначенные на них задачи.' 
        }, 403);
      }
    }

    let task = {
      ...existingTask,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Логика для повторяющихся задач
    // Если задача повторяющаяся и её переводят в статус "done", автоматически возобновляем
    if (task.isRecurring && updates.status === 'done' && existingTask.status !== 'done') {
      console.log(`🔄 Повторяющаяся задача переведена в done, возобновляем...`);
      
      // Сбрасываем статус обратно на todo
      task.status = 'todo';
      
      // Обновляем дедлайн: текущая дата + интервал
      const intervalDays = task.recurringIntervalDays || 1;
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + intervalDays);
      task.deadline = newDeadline.toISOString();
      
      console.log(`✅ Задача возобновлена с новым дедлайном: ${task.deadline}`);
    }

    console.log(`🔄 Updating task ${taskId} with key: ${storageKey}`, {
      oldAssigneeId: existingTask.assigneeId,
      newAssigneeId: task.assigneeId,
      updates,
      isRecurring: task.isRecurring,
    });

    await kv.set(storageKey, task);
    console.log(`✅ Task updated successfully`);
    return c.json({ task });
  } catch (error) {
    console.log('Update task error:', error);
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

// Delete task
app.delete("/make-server-d9879966/tasks/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    
    // Try to find and delete task from personal tasks first
    let found = false;
    const personalTask = await kv.get(`task:user:${user.id}:${taskId}`);
    if (personalTask) {
      await kv.del(`task:user:${user.id}:${taskId}`);
      console.log(`Deleted personal task: task:user:${user.id}:${taskId}`);
      found = true;
    }
    
    // If not found in personal tasks, search in project tasks
    if (!found) {
      const allProjects = await kv.getByPrefix(`project:user:`) || [];
      const userProjects = allProjects.filter((project: any) => {
        if (project.userId === user.id) return true;
        if (project.members && Array.isArray(project.members)) {
          return project.members.some((member: any) => 
            member.userId === user.id || member.email === user.email
          );
        }
        return false;
      });
      
      for (const project of userProjects) {
        const projectTask = await kv.get(`task:project:${project.id}:${taskId}`);
        if (projectTask) {
          // Check permissions before deleting
          const userRole = getUserRoleInProject(project, user.id, user.email);
          
          if (!canEditTask(userRole, projectTask, user.id)) {
            return c.json({ 
              error: 'У вас нет прав для удаления этой задачи. Участники могут удалять только назначенные на них задачи.' 
            }, 403);
          }
          
          await kv.del(`task:project:${project.id}:${taskId}`);
          console.log(`Deleted project task: task:project:${project.id}:${taskId}`);
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      return c.json({ error: 'Task not found' }, 404);
    }
    
    console.log('✅ Task deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.log('Delete task error:', error);
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

// ========== TASK ATTACHMENTS ROUTES ==========

// Upload task attachment
app.post("/make-server-d9879966/tasks/:id/attachments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 10MB' }, 400);
    }

    const bucketName = 'make-d9879966-task-files';
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${taskId}/attachment-${Date.now()}.${fileExt}`;

    // Upload file to storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Failed to upload file' }, 500);
    }

    // Generate signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (urlError) {
      console.error('URL generation error:', urlError);
      return c.json({ error: 'Failed to generate file URL' }, 500);
    }

    // Create attachment metadata
    const attachment = {
      id: `attachment-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: urlData.signedUrl,
      path: fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id,
    };

    // Get task and update attachments
    // First, try to find the task by searching all possible locations
    let task = null;
    let taskKey = null;
    
    // Try personal task first
    const personalKey = `task:user:${user.id}:${taskId}`;
    task = await kv.get(personalKey);
    if (task) {
      taskKey = personalKey;
    } else {
      // Try to find in project tasks - we need to search by prefix
      const projectTasks = await kv.getByPrefix(`task:project:`);
      const foundTask = projectTasks.find((t: any) => t.id === taskId);
      if (foundTask && foundTask.projectId) {
        task = foundTask;
        taskKey = `task:project:${foundTask.projectId}:${taskId}`;
      }
    }
    
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Verify user has access to this task
    if (task.userId !== user.id && task.assigneeId !== user.id) {
      // Check if user is a project member
      if (task.projectId) {
        const project = await kv.get(`project:${task.projectId}`);
        const isMember = project?.members?.some((m: any) => m.userId === user.id);
        if (!isMember) {
          return c.json({ error: 'Access denied' }, 403);
        }
      } else {
        return c.json({ error: 'Access denied' }, 403);
      }
    }
    
    const updatedTask = {
      ...task,
      attachments: [...(task.attachments || []), attachment],
      updatedAt: new Date().toISOString(),
    };
    
    // Update task in the correct location
    await kv.set(taskKey, updatedTask);

    return c.json({ attachment });
  } catch (error) {
    console.log('Upload attachment error:', error);
    return c.json({ error: 'Failed to upload attachment' }, 500);
  }
});

// Delete task attachment
app.delete("/make-server-d9879966/tasks/:id/attachments/:attachmentId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');

    // Get task
    const task = await kv.get(`task:user:${user.id}:${taskId}`) || 
                 await kv.get(`task:project:${taskId}:${taskId}`);
    
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Find attachment
    const attachment = task.attachments?.find((a: any) => a.id === attachmentId);
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    // Delete from storage
    const bucketName = 'make-d9879966-task-files';
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([attachment.path]);

    if (deleteError) {
      console.error('Storage delete error:', deleteError);
      // Continue anyway to clean up metadata
    }

    // Update task attachments
    const updatedTask = {
      ...task,
      attachments: task.attachments.filter((a: any) => a.id !== attachmentId),
      updatedAt: new Date().toISOString(),
    };

    // Update in appropriate location
    if (task.projectId) {
      await kv.set(`task:project:${task.projectId}:${taskId}`, updatedTask);
    } else {
      await kv.set(`task:user:${user.id}:${taskId}`, updatedTask);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Delete attachment error:', error);
    return c.json({ error: 'Failed to delete attachment' }, 500);
  }
});

// ========== PROJECTS ROUTES ==========

// Get all projects for user
app.get("/make-server-d9879966/projects", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's own projects
    const ownProjects = await kv.getByPrefix(`project:user:${user.id}:`) || [];
    
    // Get all projects where user is a member
    const allUserProjects = await kv.getByPrefix(`project:user:`);
    const sharedProjects = (allUserProjects || []).filter((project: any) => {
      // Don't include own projects twice
      if (project.userId === user.id) return false;
      
      // Check if user is in members list
      if (project.members && Array.isArray(project.members)) {
        return project.members.some((member: any) => 
          member.userId === user.id || member.email === user.email
        );
      }
      return false;
    });
    
    // Combine and filter out archived projects
    const allProjects = [...ownProjects, ...sharedProjects].filter((p: any) => !p.archived);
    console.log(`User ${user.id} (${user.email}) has ${ownProjects.length} own projects and ${sharedProjects.length} shared projects`);
    console.log(`After filtering archived: ${allProjects.length} active projects`);
    console.log(`Own projects:`, ownProjects.filter((p: any) => !p.archived).map((p: any) => `${p.name} (id: ${p.id})`));
    console.log(`Shared projects:`, sharedProjects.filter((p: any) => !p.archived).map((p: any) => `${p.name} (id: ${p.id}, members: ${p.members?.length || 0})`));
    
    return c.json({ projects: allProjects });
  } catch (error) {
    console.log('Get projects error:', error);
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

// Create project
app.post("/make-server-d9879966/projects", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectData = await c.req.json();
    const projectId = crypto.randomUUID();
    
    // Create owner member entry
    const ownerMember = {
      id: `member-${Date.now()}`,
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      role: 'owner',
      addedDate: new Date().toISOString(),
      addedBy: user.id,
    };
    
    const project = {
      id: projectId,
      ...projectData,
      userId: user.id,
      members: [ownerMember], // Initialize with owner as first member
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:user:${user.id}:${projectId}`, project);
    return c.json({ project });
  } catch (error) {
    console.log('Create project error:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

// Update project
app.put("/make-server-d9879966/projects/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const updates = await c.req.json();
    
    // First try to find project where user is owner
    let existingProject = await kv.get(`project:user:${user.id}:${projectId}`);
    let isOwner = !!existingProject;
    
    // If not owner, find project where user is member
    if (!existingProject) {
      const allProjects = await kv.getByPrefix(`project:user:`) || [];
      existingProject = allProjects.find((p: any) => {
        if (p.id === projectId && p.members && Array.isArray(p.members)) {
          return p.members.some((m: any) => m.userId === user.id || m.email === user.email);
        }
        return false;
      });
    }
    
    if (!existingProject) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check permissions
    const userRole = getUserRoleInProject(existingProject, user.id, user.email);
    
    if (!canEditProject(userRole)) {
      return c.json({ 
        error: 'У вас нет прав для редактирования проекта. Только владелец и администраторы могут редактировать проект.' 
      }, 403);
    }

    const project = {
      ...existingProject,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save to owner's key (projects are always stored under owner's ID)
    await kv.set(`project:user:${existingProject.userId}:${projectId}`, project);
    return c.json({ project });
  } catch (error) {
    console.log('Update project error:', error);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

// Delete project
app.delete("/make-server-d9879966/projects/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    
    // Get project to check permissions
    const existingProject = await kv.get(`project:user:${user.id}:${projectId}`);
    
    if (!existingProject) {
      return c.json({ error: 'Project not found or access denied' }, 404);
    }
    
    // Check permissions - only owner can delete
    const userRole = getUserRoleInProject(existingProject, user.id, user.email);
    
    if (!canDeleteProject(userRole)) {
      return c.json({ 
        error: 'У вас нет прав для удаления проекта. Только владелец может удалить проект.' 
      }, 403);
    }
    
    // Delete project
    await kv.del(`project:user:${user.id}:${projectId}`);
    
    // Delete all tasks in project
    const projectTasks = await kv.getByPrefix(`task:project:${projectId}:`);
    if (projectTasks) {
      for (const task of projectTasks) {
        await kv.del(`task:project:${projectId}:${task.id}`);
      }
    }
    
    console.log('✅ Project and all associated tasks deleted successfully');
    return c.json({ success: true });
  } catch (error) {
    console.log('Delete project error:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// Archive project
app.post("/make-server-d9879966/projects/:id/archive", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    console.log(`📦 Archiving project ${projectId}`);
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    // Check if user is owner
    const userRole = getUserRoleInProject(project, user.id, user.email);
    if (userRole !== 'owner') {
      return c.json({ 
        error: 'У вас нет прав для архивирования проекта. Только владелец может архивировать проект.' 
      }, 403);
    }
    
    // Update project with archived flag
    const archivedProject = {
      ...project,
      archived: true,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated project
    await kv.set(`project:user:${project.userId}:${projectId}`, archivedProject);
    
    console.log('✅ Project archived successfully');
    return c.json({ project: archivedProject });
  } catch (error) {
    console.log('Archive project error:', error);
    return c.json({ error: 'Failed to archive project' }, 500);
  }
});

// Restore project from archive
app.post("/make-server-d9879966/projects/:id/restore", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    console.log(`📦 Restoring project ${projectId} from archive`);
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    // Check if user is owner
    const userRole = getUserRoleInProject(project, user.id, user.email);
    if (userRole !== 'owner') {
      return c.json({ 
        error: 'У вас нет прав для восстановления проекта. Только владелец может восстановить проект.' 
      }, 403);
    }
    
    // Update project - remove archived flag
    const restoredProject = {
      ...project,
      archived: false,
      archivedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated project
    await kv.set(`project:user:${project.userId}:${projectId}`, restoredProject);
    
    console.log('✅ Project restored from archive successfully');
    return c.json({ project: restoredProject });
  } catch (error) {
    console.log('Restore project error:', error);
    return c.json({ error: 'Failed to restore project' }, 500);
  }
});

// Get archived projects
app.get("/make-server-d9879966/projects/archived", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`📦 Getting archived projects for user ${user.id}`);
    
    // Get all projects
    const allProjects = await kv.getByPrefix(`project:user:`);
    
    // Filter archived projects where user is owner or member
    const archivedProjects = allProjects.filter((project: any) => {
      if (!project.archived) return false;
      
      // Check if user is owner
      if (project.userId === user.id) return true;
      
      // Check if user is member
      if (project.members && Array.isArray(project.members)) {
        return project.members.some((member: any) => 
          member.userId === user.id || member.email === user.email
        );
      }
      
      return false;
    });
    
    console.log(`Found ${archivedProjects.length} archived projects for user ${user.id}`);
    return c.json({ projects: archivedProjects });
  } catch (error) {
    console.log('Get archived projects error:', error);
    return c.json({ error: 'Failed to fetch archived projects' }, 500);
  }
});

// Get tasks for a specific project
app.get("/make-server-d9879966/projects/:id/tasks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const tasks = await kv.getByPrefix(`task:project:${projectId}:`);
    
    return c.json({ tasks: tasks || [] });
  } catch (error) {
    console.log('Get project tasks error:', error);
    return c.json({ error: 'Failed to fetch project tasks' }, 500);
  }
});

// ========== PROJECT MEMBERS ROUTES ==========

// Get project members
app.get("/make-server-d9879966/projects/:id/members", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { user, error } = await getUserFromToken(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    
    // Get project to access members
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      console.log(`Project ${projectId} not found`);
      return c.json({ members: [] });
    }
    
    const members = project.members || [];
    console.log(`Found ${members.length} members for project ${projectId}`);
    
    return c.json({ members });
  } catch (error) {
    console.log('Get project members error:', error);
    return c.json({ error: 'Failed to fetch project members' }, 500);
  }
});

// Add project member
app.post("/make-server-d9879966/projects/:id/members", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const { userId, role } = await c.req.json();
    
    const members = await kv.get(`project:${projectId}:members`) || [];
    
    // Check if member already exists
    if (members.some((m: any) => m.userId === userId)) {
      return c.json({ error: 'Member already exists' }, 400);
    }
    
    const newMember = {
      id: `member-${Date.now()}`,
      userId,
      role,
      addedDate: new Date().toISOString(),
      addedBy: user.id,
    };
    
    members.push(newMember);
    await kv.set(`project:${projectId}:members`, members);
    
    return c.json({ member: newMember });
  } catch (error) {
    console.log('Add project member error:', error);
    return c.json({ error: 'Failed to add project member' }, 500);
  }
});

// Update project member role
app.put("/make-server-d9879966/projects/:id/members/:memberId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const { role } = await c.req.json();
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    const members = project.members || [];
    const updatedMembers = members.map((m: any) => 
      m.id === memberId || m.userId === memberId ? { ...m, role, updatedAt: new Date().toISOString() } : m
    );
    
    const updatedProject = {
      ...project,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`project:user:${project.userId}:${projectId}`, updatedProject);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Update project member error:', error);
    return c.json({ error: 'Failed to update project member' }, 500);
  }
});

// Remove project member
app.delete("/make-server-d9879966/projects/:id/members/:memberId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const memberId = c.req.param('memberId');
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    const members = project.members || [];
    const updatedMembers = members.filter((m: any) => m.id !== memberId && m.userId !== memberId);
    
    const updatedProject = {
      ...project,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`project:user:${project.userId}:${projectId}`, updatedProject);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Remove project member error:', error);
    return c.json({ error: 'Failed to remove project member' }, 500);
  }
});

// ========== PROJECT INVITATIONS ROUTES ==========

// Get project invitations
app.get("/make-server-d9879966/projects/:id/invitations", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      console.log('Get invitations: No access token provided');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      console.log('Get invitations: Invalid access token or user not found:', error);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const invitations = await kv.get(`project:${projectId}:invitations`) || [];
    
    console.log(`Retrieved ${invitations.length} invitations for project ${projectId}`);
    
    return c.json({ invitations });
  } catch (error) {
    console.log('Get project invitations error:', error);
    return c.json({ error: 'Failed to fetch project invitations' }, 500);
  }
});

// Create project invitation
app.post("/make-server-d9879966/projects/:id/invitations", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      console.log('Create invitation: No access token provided');
      return c.json({ error: 'Unauthorized - No access token' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      console.log('Create invitation: Invalid access token or user not found:', error);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const projectId = c.req.param('id');
    const { email, role } = await c.req.json();
    
    console.log(`Creating invitation for project ${projectId} to email ${email} with role ${role} by user ${user.id}`);
    
    if (!email || !role) {
      console.log('Create invitation: Missing email or role');
      return c.json({ error: 'Email and role are required' }, 400);
    }
    
    const invitations = await kv.get(`project:${projectId}:invitations`) || [];
    console.log(`Found ${invitations.length} existing invitations for project ${projectId}`);
    
    // Check for existing pending invitation
    if (invitations.some((inv: any) => inv.email === email && inv.status === 'pending')) {
      console.log(`Invitation already exists for ${email}`);
      return c.json({ error: 'Приглашение уже отправлено на этот email' }, 400);
    }
    
    const newInvitation = {
      id: `inv-${Date.now()}`,
      projectId, // Store project ID in invitation
      email,
      role,
      status: 'pending',
      sentDate: new Date().toISOString(),
      sentBy: user.id,
      link: `https://t24.app/invite/${Math.random().toString(36).substr(2, 9)}`,
    };
    
    invitations.push(newInvitation);
    await kv.set(`project:${projectId}:invitations`, invitations);
    
    console.log(`Successfully created invitation ${newInvitation.id} for ${email}`);
    
    return c.json({ invitation: newInvitation });
  } catch (error) {
    console.log('Create project invitation error (catch block):', error);
    return c.json({ error: 'Failed to create project invitation' }, 500);
  }
});

// Revoke project invitation
app.put("/make-server-d9879966/projects/:id/invitations/:invitationId/revoke", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const invitationId = c.req.param('invitationId');
    
    const invitations = await kv.get(`project:${projectId}:invitations`) || [];
    const updatedInvitations = invitations.map((inv: any) => 
      inv.id === invitationId ? { ...inv, status: 'revoked', revokedAt: new Date().toISOString() } : inv
    );
    
    await kv.set(`project:${projectId}:invitations`, updatedInvitations);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Revoke project invitation error:', error);
    return c.json({ error: 'Failed to revoke project invitation' }, 500);
  }
});

// Resend project invitation
app.put("/make-server-d9879966/projects/:id/invitations/:invitationId/resend", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const invitationId = c.req.param('invitationId');
    
    const invitations = await kv.get(`project:${projectId}:invitations`) || [];
    const updatedInvitations = invitations.map((inv: any) => 
      inv.id === invitationId ? { 
        ...inv, 
        status: 'pending', 
        sentDate: new Date().toISOString(),
        link: `https://t24.app/invite/${Math.random().toString(36).substr(2, 9)}`,
      } : inv
    );
    
    await kv.set(`project:${projectId}:invitations`, updatedInvitations);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Resend project invitation error:', error);
    return c.json({ error: 'Failed to resend project invitation' }, 500);
  }
});

// Accept project invitation
app.post("/make-server-d9879966/projects/:id/invitations/:invitationId/accept", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('id');
    const invitationId = c.req.param('invitationId');
    
    console.log(`User ${user.email} accepting invitation ${invitationId} for project ${projectId}`);
    
    // Get invitation
    const invitations = await kv.get(`project:${projectId}:invitations`) || [];
    const invitation = invitations.find((inv: any) => inv.id === invitationId);
    
    if (!invitation) {
      console.log(`Invitation ${invitationId} not found`);
      return c.json({ error: 'Invitation not found' }, 404);
    }
    
    if (invitation.status !== 'pending') {
      console.log(`Invitation ${invitationId} is not pending (status: ${invitation.status})`);
      return c.json({ error: 'Invitation is not valid' }, 400);
    }
    
    if (invitation.email !== user.email) {
      console.log(`User email ${user.email} does not match invitation email ${invitation.email}`);
      return c.json({ error: 'This invitation was sent to a different email address' }, 403);
    }
    
    // Get project to find owner
    const allProjects = await kv.getByPrefix(`project:user:`);
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      console.log(`Project ${projectId} not found`);
      return c.json({ error: 'Project not found' }, 404);
    }
    
    // Add user to project members
    const members = project.members || [];
    
    // Check if already a member
    const isMember = members.some((m: any) => m.userId === user.id || m.email === user.email);
    if (isMember) {
      console.log(`User ${user.email} is already a member of project ${projectId}`);
      // Still mark invitation as accepted
      const updatedInvitations = invitations.map((inv: any) => 
        inv.id === invitationId ? { ...inv, status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: user.id } : inv
      );
      await kv.set(`project:${projectId}:invitations`, updatedInvitations);
      return c.json({ success: true, message: 'Already a member' });
    }
    
    const newMember = {
      id: `member-${Date.now()}`,
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      role: invitation.role,
      addedDate: new Date().toISOString(),
      addedBy: invitation.sentBy,
    };
    
    members.push(newMember);
    
    // Update project with new member
    const updatedProject = {
      ...project,
      members,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`project:user:${project.userId}:${projectId}`, updatedProject);
    
    // Mark invitation as accepted
    const updatedInvitations = invitations.map((inv: any) => 
      inv.id === invitationId ? { ...inv, status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: user.id } : inv
    );
    await kv.set(`project:${projectId}:invitations`, updatedInvitations);
    
    console.log(`Successfully added user ${user.email} to project ${projectId} with role ${invitation.role}`);
    
    return c.json({ success: true, member: newMember });
  } catch (error) {
    console.log('Accept project invitation error:', error);
    return c.json({ error: 'Failed to accept project invitation' }, 500);
  }
});

// Get user's pending invitations (all projects)
app.get("/make-server-d9879966/invitations/my", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`Getting pending invitations for user ${user.email}`);
    
    // Get all projects
    const allProjects = await kv.getByPrefix(`project:user:`) || [];
    const myInvitations: any[] = [];
    
    // For each project, get its invitations
    for (const project of allProjects) {
      const projectInvitations = await kv.get(`project:${project.id}:invitations`) || [];
      
      // Filter for user's pending invitations
      for (const inv of projectInvitations) {
        if (inv.email === user.email && inv.status === 'pending') {
          // Add project info to invitation
          myInvitations.push({
            ...inv,
            projectId: project.id,
            projectName: project.name,
            projectColor: project.color,
          });
        }
      }
    }
    
    console.log(`Found ${myInvitations.length} pending invitations for user ${user.email}`);
    
    return c.json({ invitations: myInvitations });
  } catch (error) {
    console.log('Get my invitations error:', error);
    return c.json({ error: 'Failed to fetch invitations' }, 500);
  }
});

// ========== TASK ATTACHMENTS ROUTES ==========

// Upload task attachment
app.post("/make-server-d9879966/tasks/:id/attachments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'Файл слишком большой. Максимальный размер 10MB' }, 400);
    }

    const bucketName = 'make-d9879966-task-files';
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${taskId}/${Date.now()}-${file.name}`;

    // Upload file
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Ошибка загрузки файла' }, 500);
    }

    // Generate signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 31536000); // 1 year in seconds

    if (urlError) {
      console.error('URL generation error:', urlError);
      return c.json({ error: 'Ошибка генерации URL файла' }, 500);
    }

    // Get task and update attachments
    const task = await kv.get(`task:user:${user.id}:${taskId}`);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: urlData.signedUrl,
      path: fileName,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id,
    };

    const attachments = task.attachments || [];
    attachments.push(attachment);

    const updatedTask = {
      ...task,
      attachments,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`task:user:${user.id}:${taskId}`, updatedTask);
    
    // Also update in project storage if task belongs to a project
    if (task.projectId) {
      await kv.set(`task:project:${task.projectId}:${taskId}`, updatedTask);
    }

    return c.json({ attachment, success: true });
  } catch (error) {
    console.error('Upload task attachment error:', error);
    return c.json({ error: 'Ошибка загрузки файла' }, 500);
  }
});

// Delete task attachment
app.delete("/make-server-d9879966/tasks/:id/attachments/:attachmentId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    
    const task = await kv.get(`task:user:${user.id}:${taskId}`);
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const attachments = task.attachments || [];
    const attachment = attachments.find((a: any) => a.id === attachmentId);
    
    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    // Delete from storage
    const bucketName = 'make-d9879966-task-files';
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([attachment.path]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      // Continue anyway - file might already be deleted
    }

    // Update task
    const updatedAttachments = attachments.filter((a: any) => a.id !== attachmentId);
    const updatedTask = {
      ...task,
      attachments: updatedAttachments,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`task:user:${user.id}:${taskId}`, updatedTask);
    
    // Also update in project storage if task belongs to a project
    if (task.projectId) {
      await kv.set(`task:project:${task.projectId}:${taskId}`, updatedTask);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete task attachment error:', error);
    return c.json({ error: 'Ошибка удаления файла' }, 500);
  }
});

// ========== TEAM MEMBERS ROUTES ==========

// Get all team members (aggregated from all projects)
app.get("/make-server-d9879966/team/members", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all user's projects
    const projects = await kv.getByPrefix(`project:user:${user.id}:`) || [];
    
    // Collect all unique members from all projects
    const membersMap = new Map();
    
    // Add current user
    const currentUserProfile = await kv.get(`user:${user.id}`);
    membersMap.set(user.id, {
      id: user.id,
      name: currentUserProfile?.name || user.user_metadata?.name || 'Вы',
      email: user.email,
      avatarUrl: currentUserProfile?.avatarUrl,
    });
    
    // Add members from projects
    for (const project of projects) {
      if (project.members) {
        for (const member of project.members) {
          // Use userId if available (real members), fallback to id (legacy/mock members)
          const memberId = member.userId || member.id;
          if (memberId && !membersMap.has(memberId)) {
            // Try to get user profile from KV store for real members
            let memberData = null;
            if (member.userId) {
              memberData = await kv.get(`user:${member.userId}`);
            }
            
            membersMap.set(memberId, {
              id: memberId,
              name: memberData?.name || member.name || member.email,
              email: member.email,
              avatarUrl: memberData?.avatarUrl || member.avatar,
            });
          }
        }
      }
    }
    
    const members = Array.from(membersMap.values());
    return c.json({ members });
  } catch (error) {
    console.error('Get team members error:', error);
    return c.json({ error: 'Ошибка загрузки участников' }, 500);
  }
});

// ========== DIAGNOSTICS & MIGRATION ROUTES ==========

// Diagnose project tasks
app.get("/make-server-d9879966/diagnostics/project/:projectId/tasks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`) || [];
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    // Get project tasks (new format)
    const projectTasks = await kv.getByPrefix(`task:project:${projectId}:`) || [];
    
    // Get owner's personal tasks that might belong to this project (old format)
    const ownerTasks = await kv.getByPrefix(`task:user:${project.userId}:`) || [];
    const oldFormatTasks = ownerTasks.filter((t: any) => t.projectId === projectId);
    
    // Get all tasks keys
    const allTaskKeys: string[] = [];
    for (const task of projectTasks) {
      allTaskKeys.push(`task:project:${projectId}:${task.id}`);
    }
    for (const task of oldFormatTasks) {
      allTaskKeys.push(`task:user:${project.userId}:${task.id}`);
    }
    
    return c.json({
      projectId,
      projectName: project.name,
      projectOwnerId: project.userId,
      currentUserId: user.id,
      projectTasksCount: projectTasks.length,
      oldFormatTasksCount: oldFormatTasks.length,
      projectTasks: projectTasks.map((t: any) => ({ id: t.id, title: t.title, key: `task:project:${projectId}:${t.id}` })),
      oldFormatTasks: oldFormatTasks.map((t: any) => ({ id: t.id, title: t.title, key: `task:user:${project.userId}:${t.id}` })),
      allTaskKeys,
      needsMigration: oldFormatTasks.length > 0,
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    return c.json({ error: 'Failed to run diagnostics' }, 500);
  }
});

// Migrate project tasks from old format to new format
app.post("/make-server-d9879966/diagnostics/project/:projectId/migrate-tasks", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const projectId = c.req.param('projectId');
    
    // Get project
    const allProjects = await kv.getByPrefix(`project:user:`) || [];
    const project = allProjects.find((p: any) => p.id === projectId);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    // Only owner can migrate
    if (project.userId !== user.id) {
      return c.json({ error: 'Only project owner can migrate tasks' }, 403);
    }
    
    // Get owner's personal tasks that belong to this project (old format)
    const ownerTasks = await kv.getByPrefix(`task:user:${project.userId}:`) || [];
    const tasksToMigrate = ownerTasks.filter((t: any) => t.projectId === projectId);
    
    console.log(`Migrating ${tasksToMigrate.length} tasks for project ${projectId} (${project.name})`);
    
    const migratedTasks = [];
    for (const task of tasksToMigrate) {
      const oldKey = `task:user:${project.userId}:${task.id}`;
      const newKey = `task:project:${projectId}:${task.id}`;
      
      // Copy to new location
      await kv.set(newKey, task);
      
      // Delete from old location
      await kv.del(oldKey);
      
      console.log(`Migrated task ${task.id} (${task.title}) from ${oldKey} to ${newKey}`);
      migratedTasks.push({ id: task.id, title: task.title, oldKey, newKey });
    }
    
    return c.json({
      success: true,
      migratedCount: migratedTasks.length,
      migratedTasks,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return c.json({ error: 'Failed to migrate tasks' }, 500);
  }
});

// ========== USER SETTINGS ROUTES (Custom Columns) ==========

// Get user's custom columns
app.get("/make-server-d9879966/user/settings/custom-columns", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const customColumns = await kv.get(`user:${user.id}:custom-columns`) || [];
    console.log(`✅ Retrieved ${customColumns.length} custom columns for user ${user.id}:`, customColumns);
    
    return c.json({ customColumns });
  } catch (error) {
    console.error('Get custom columns error:', error);
    return c.json({ error: 'Failed to fetch custom columns' }, 500);
  }
});

// Save user's custom columns
app.post("/make-server-d9879966/user/settings/custom-columns", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { customColumns } = await c.req.json();
    
    if (!Array.isArray(customColumns)) {
      return c.json({ error: 'Invalid custom columns data' }, 400);
    }

    await kv.set(`user:${user.id}:custom-columns`, customColumns);
    console.log(`✅ Saved ${customColumns.length} custom columns for user ${user.id}:`, customColumns);
    
    return c.json({ success: true, customColumns });
  } catch (error) {
    console.error('Save custom columns error:', error);
    return c.json({ error: 'Failed to save custom columns' }, 500);
  }
});

// Clean up duplicate project tasks for current user
app.post("/make-server-d9879966/tasks/cleanup-duplicates", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`🧹 Starting duplicate cleanup for user ${user.id} (${user.email})...`);

    // Get all user's projects
    const allProjects = await kv.getByPrefix(`project:user:`) || [];
    const userProjects = allProjects.filter((project: any) => project.userId === user.id);
    
    console.log(`  Found ${userProjects.length} projects owned by user`);

    let totalCleaned = 0;
    const cleanedProjects: any[] = [];

    // For each project, find and remove duplicate tasks
    for (const project of userProjects) {
      const projectTasks = await kv.getByPrefix(`task:project:${project.id}:`) || [];
      const userTasksForProject = await kv.getByPrefix(`task:user:${user.id}:`) || [];
      const duplicates = userTasksForProject.filter((t: any) => t.projectId === project.id);
      
      if (duplicates.length > 0) {
        console.log(`  📁 Project "${project.name}" (${project.id}): found ${duplicates.length} duplicates`);
        
        for (const duplicate of duplicates) {
          const duplicateKey = `task:user:${user.id}:${duplicate.id}`;
          const projectKey = `task:project:${project.id}:${duplicate.id}`;
          
          // Check if task exists in project namespace
          const projectTask = await kv.get(projectKey);
          
          if (projectTask) {
            // Duplicate exists - delete the one in user namespace
            await kv.del(duplicateKey);
            console.log(`    ✅ Deleted duplicate: ${duplicateKey} (task: ${duplicate.title})`);
            totalCleaned++;
          } else {
            // Task only exists in user namespace - migrate it to project namespace
            await kv.set(projectKey, duplicate);
            await kv.del(duplicateKey);
            console.log(`    ✅ Migrated and deleted: ${duplicateKey} -> ${projectKey} (task: ${duplicate.title})`);
            totalCleaned++;
          }
        }
        
        cleanedProjects.push({
          projectId: project.id,
          projectName: project.name,
          duplicatesRemoved: duplicates.length,
        });
      }
    }

    console.log(`✅ Cleanup complete: removed ${totalCleaned} duplicate tasks across ${cleanedProjects.length} projects`);

    return c.json({
      success: true,
      totalCleaned,
      cleanedProjects,
      message: `Успешно удалено ${totalCleaned} дубликатов задач`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return c.json({ error: 'Failed to cleanup duplicates' }, 500);
  }
});

// ========== CATEGORIES ROUTES ==========

// Get all categories for user
app.get("/make-server-d9879966/categories", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's own categories
    const ownCategories = await kv.getByPrefix(`category:user:${user.id}:`) || [];
    console.log(`✅ Found ${ownCategories.length} own categories for user ${user.id}`);
    
    // Get all user's projects (own + shared)
    const ownProjects = await kv.getByPrefix(`project:user:${user.id}:`) || [];
    const allUserProjects = await kv.getByPrefix(`project:user:`);
    const sharedProjects = (allUserProjects || []).filter((project: any) => {
      if (project.userId === user.id) return false;
      if (project.members && Array.isArray(project.members)) {
        return project.members.some((member: any) => 
          member.userId === user.id || member.email === user.email
        );
      }
      return false;
    });
    
    const allProjects = [...ownProjects, ...sharedProjects];
    console.log(`📦 User participates in ${allProjects.length} projects`);
    
    // Collect all category IDs from projects
    const projectCategoryIds = new Set<string>();
    for (const project of allProjects) {
      if (project.availableCategories && Array.isArray(project.availableCategories)) {
        project.availableCategories.forEach((catId: string) => projectCategoryIds.add(catId));
      }
    }
    
    console.log(`🏷️ Found ${projectCategoryIds.size} unique category IDs in projects`);
    
    // Load categories from projects (they might belong to other users)
    const projectCategories: any[] = [];
    const allCategories = await kv.getByPrefix(`category:user:`) || [];
    
    for (const category of allCategories) {
      if (projectCategoryIds.has(category.id)) {
        projectCategories.push(category);
      }
    }
    
    console.log(`📥 Loaded ${projectCategories.length} project categories`);
    
    // Combine and deduplicate by ID
    const categoriesMap = new Map();
    
    // Add own categories first
    ownCategories.forEach((cat: any) => categoriesMap.set(cat.id, cat));
    
    // Add project categories (don't override own categories)
    projectCategories.forEach((cat: any) => {
      if (!categoriesMap.has(cat.id)) {
        categoriesMap.set(cat.id, cat);
      }
    });
    
    const allUserCategories = Array.from(categoriesMap.values());
    console.log(`✅ Total ${allUserCategories.length} categories available for user ${user.id}`);
    
    return c.json({ categories: allUserCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({ error: 'Ошибка загрузки категорий' }, 500);
  }
});

// Create new category
app.post("/make-server-d9879966/categories", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { name, color, description } = body;

    if (!name || !color) {
      return c.json({ error: 'Название и цвет обязательны' }, 400);
    }

    const categoryId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newCategory = {
      id: categoryId,
      name,
      color,
      description: description || '',
      userId: user.id,
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`category:user:${user.id}:${categoryId}`, newCategory);
    console.log(`✅ Created category: ${name} (${categoryId}) for user ${user.id}`);

    return c.json({ category: newCategory });
  } catch (error) {
    console.error('Create category error:', error);
    return c.json({ error: 'Ошибка создания категории' }, 500);
  }
});

// Update category
app.put("/make-server-d9879966/categories/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const categoryId = c.req.param('id');
    const category = await kv.get(`category:user:${user.id}:${categoryId}`);

    if (!category) {
      return c.json({ error: 'Категория не найдена' }, 404);
    }

    // Category is already in user's namespace, no additional check needed

    const body = await c.req.json();
    const updatedCategory = {
      ...category,
      ...body,
      id: categoryId,
      userId: user.id,
      createdAt: category.createdAt, // Preserve original creation date
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`category:user:${user.id}:${categoryId}`, updatedCategory);
    console.log(`✅ Updated category: ${categoryId} for user ${user.id}`);

    return c.json({ category: updatedCategory });
  } catch (error) {
    console.error('Update category error:', error);
    return c.json({ error: 'Ошибка обновления категории' }, 500);
  }
});

// Delete category
app.delete("/make-server-d9879966/categories/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const categoryId = c.req.param('id');
    const category = await kv.get(`category:user:${user.id}:${categoryId}`);

    if (!category) {
      return c.json({ error: 'Категория не найдена' }, 404);
    }

    // Category is already in user's namespace, no additional check needed

    await kv.del(`category:user:${user.id}:${categoryId}`);
    console.log(`✅ Deleted category: ${categoryId} for user ${user.id}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return c.json({ error: 'Ошибка удаления категории' }, 500);
  }
});

// ========== SERVER INITIALIZATION ==========

// Initialize storage buckets on server startup
(async () => {
  try {
    console.log('🚀 Initializing storage buckets...');
    
    const bucketName = 'make-d9879966-task-files';
    
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`📦 Creating bucket: ${bucketName}`);
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (error) {
        console.error('❌ Failed to create bucket:', error);
      } else {
        console.log('✅ Bucket created successfully');
      }
    } else {
      console.log('✅ Bucket already exists');
    }
  } catch (error) {
    console.error('❌ Bucket initialization error:', error);
  }
})();

Deno.serve(app.fetch);