const fs = require('fs');
const path = require('path');

// Paths to create
const paths = [
  'node_modules/@d11/react-native-fast-image/android/build/generated/source/codegen/jni',
  'node_modules/@react-native-async-storage/async-storage/android/build/generated/source/codegen/jni',
  'node_modules/react-native-share/android/build/generated/source/codegen/jni',
  'node_modules/react-native-vector-icons/android/build/generated/source/codegen/jni'
];

// Create empty CMakeLists.txt content
const cmakeContent = '# Empty CMakeLists.txt\n';

// Create directories and files
paths.forEach(dirPath => {
  const fullPath = path.resolve(__dirname, dirPath);
  
  // Create directory recursively
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
  
  // Create empty CMakeLists.txt file
  const cmakeFile = path.join(fullPath, 'CMakeLists.txt');
  fs.writeFileSync(cmakeFile, cmakeContent);
  console.log(`Created file: ${cmakeFile}`);
});

console.log('Codegen directories and files created successfully!'); 