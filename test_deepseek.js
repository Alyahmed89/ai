const { callDeepSeek } = require('./src/services/deepseek');

async function test() {
  try {
    console.log('Testing DeepSeek API...');
    const result = await callDeepSeek('test prompt', 'test-conversation');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
