import fs from 'node:fs';
import path from 'node:path';

const API_URL = 'http://localhost:3001/api';

async function main() {
  try {
    console.log('--- Reproduction Script ---');

    // 1. Sign In
    const email = 'admin@example.com';
    const password = 'admin123';
    console.log(`Logging in as: ${email}`);

    const loginRes = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    
    if (!loginRes.ok) {
        throw new Error(`Auth failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const authData = await loginRes.json();
    console.log('Auth response:', JSON.stringify(authData, null, 2));
    const token = authData.token;
    console.log('Got token:', token);

    if (!token) {
        throw new Error('Token is missing from auth response');
    }

    // 2. Create Task
    console.log('Creating task...');
    const taskRes = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        title: 'Test Task',
        status: 'todo'
      })
    });

    if (!taskRes.ok) {
        throw new Error(`Create task failed: ${taskRes.status} ${await taskRes.text()}`);
    }

    const taskData = await taskRes.json();
    const taskId = taskData.id;
    console.log(`Task created: ${taskId}`);

    // 3. Create dummy file
    const filePath = path.resolve('test-attachment.txt');
    fs.writeFileSync(filePath, 'Hello World');
    const fileBlob = new Blob([fs.readFileSync(filePath)], { type: 'text/plain' });

    // 4. Send Comment with File and EMPTY text
    console.log('Sending comment with file and empty text...');
    const formData = new FormData();
    formData.append('text', ''); // Empty text
    formData.append('files', fileBlob, 'test-attachment.txt');

    const commentRes = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const resultText = await commentRes.text();
    console.log(`Response Status: ${commentRes.status}`);
    console.log(`Response Body: ${resultText}`);

    // Cleanup
    fs.unlinkSync(filePath);

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
