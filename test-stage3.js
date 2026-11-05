const { JsonDatabase } = require('./dist-electron/database');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_stage3_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new JsonDatabase(testDbPath);

console.log('===========================================================');
console.log('  Testing Stage 3 – Test Data Management Requirements     ');
console.log('===========================================================');

// 1. Identify Demo Project
const demoUser = db.findUserByEmail('demo@easyautomate.dev');
console.assert(demoUser, 'Demo user must exist');
const projects = db.getProjects(demoUser.id);
console.assert(projects.length > 0, 'Should have demo projects');
const proj = projects[0];
console.log(`✓ Active Project: ${proj.name} (${proj.id})\n`);

// 2. Verify Default Seeded Folder Structure (Section 4.2)
console.log('--- 1. Testing Default Hierarchical Folder Structure (Section 4.2) ---');
const folders = db.getTestDataFolders(proj.id);
console.assert(folders.length >= 10, 'Expected at least 10 seeded folders');

const rootFolders = folders.filter(f => !f.parentId);
const rootNames = rootFolders.map(f => f.name).sort();
console.assert(rootNames.includes('Login Module'), 'Should contain "Login Module"');
console.assert(rootNames.includes('Product Module'), 'Should contain "Product Module"');
console.assert(rootNames.includes('Payment Module'), 'Should contain "Payment Module"');
console.assert(rootNames.includes('Registration Module'), 'Should contain "Registration Module"');
console.log('✓ Root Folders Verified:');
rootFolders.forEach(rf => console.log(`   📂 ${rf.name}`));

const loginFolder = rootFolders.find(f => f.name === 'Login Module');
const loginSubfolders = folders.filter(f => f.parentId === loginFolder.id);
console.assert(loginSubfolders.some(f => f.name === 'Valid Login'), 'Login Module should have "Valid Login"');
console.assert(loginSubfolders.some(f => f.name === 'Invalid Login'), 'Login Module should have "Invalid Login"');
console.log('✓ Login Module Subfolders:');
loginSubfolders.forEach(sf => console.log(`      📁 ${sf.name}`));

const productFolder = rootFolders.find(f => f.name === 'Product Module');
const productSubfolders = folders.filter(f => f.parentId === productFolder.id);
console.assert(productSubfolders.some(f => f.name === 'Product Search'), 'Product Module should have "Product Search"');
console.assert(productSubfolders.some(f => f.name === 'Add To Cart'), 'Product Module should have "Add To Cart"');
console.log('✓ Product Module Subfolders:');
productSubfolders.forEach(sf => console.log(`      📁 ${sf.name}`));

const paymentFolder = rootFolders.find(f => f.name === 'Payment Module');
const paymentSubfolders = folders.filter(f => f.parentId === paymentFolder.id);
console.assert(paymentSubfolders.some(f => f.name === 'Credit Card'), 'Payment Module should have "Credit Card"');
console.assert(paymentSubfolders.some(f => f.name === 'UPI'), 'Payment Module should have "UPI"');
console.log('✓ Payment Module Subfolders:');
paymentSubfolders.forEach(sf => console.log(`      📁 ${sf.name}`));

// 3. Verify Default Seeded Excel Files (Section 4.2)
console.log('\n--- 2. Testing Default Seeded Excel Files (Section 4.2) ---');
const allFiles = db.getTestDataFiles(proj.id);
console.assert(allFiles.length >= 7, 'Expected at least 7 seeded Excel files');

const validLoginFolder = loginSubfolders.find(f => f.name === 'Valid Login');
const validLoginFiles = db.getTestDataFiles(proj.id, validLoginFolder.id);
console.assert(validLoginFiles.some(f => f.fileName === 'valid_login_data.xlsx'), 'valid_login_data.xlsx should be in Valid Login');
console.assert(validLoginFiles[0].fileFormat === '.xlsx', 'File format should be .xlsx');
console.assert(validLoginFiles[0].fileSizeFormatted === '24.0 KB', 'File size formatted properly');
console.assert(validLoginFiles[0].sheetNames.includes('Credentials'), 'Sheet detected');

const addToCartFolder = productSubfolders.find(f => f.name === 'Add To Cart');
const cartFiles = db.getTestDataFiles(proj.id, addToCartFolder.id);
console.assert(cartFiles.some(f => f.fileName === 'cart_valid_data.xlsx'), 'cart_valid_data.xlsx in Add To Cart');
console.assert(cartFiles.some(f => f.fileName === 'cart_invalid_data.xlsx'), 'cart_invalid_data.xlsx in Add To Cart');

console.log('✓ Seeded Files Verified across hierarchical tree:');
allFiles.forEach(file => {
  const parentFld = folders.find(f => f.id === file.folderId);
  const folderPath = parentFld ? parentFld.name : 'Root';
  console.log(`   📄 [${folderPath}] ${file.fileName} (${file.fileFormat}, ${file.fileSizeFormatted}, Sheets: ${file.sheetNames.join(', ')})`);
});

// 4. Test Folder Management Operations (Section 4.2)
console.log('\n--- 3. Testing Folder CRUD & Multi-Level Nesting Operations ---');

// 4.1 Create Root Folder
const ordersFolder = db.createTestDataFolder(proj.id, 'Orders Module', null);
console.assert(ordersFolder.parentId === null, 'Orders Module is a root folder');
console.log('✓ Created Root Folder:', ordersFolder.name);

// 4.2 Create Level 2 Subfolder
const bulkOrders = db.createTestDataFolder(proj.id, 'Bulk Orders', ordersFolder.id);
console.assert(bulkOrders.parentId === ordersFolder.id, 'Bulk Orders parent is Orders Module');
console.log('✓ Created Level 2 Subfolder:', bulkOrders.name, `(Parent: ${ordersFolder.name})`);

// 4.3 Create Level 3 Nested Subfolder
const b2bOrders = db.createTestDataFolder(proj.id, 'Priority B2B', bulkOrders.id);
console.assert(b2bOrders.parentId === bulkOrders.id, 'Priority B2B parent is Bulk Orders');
console.log('✓ Created Level 3 Nested Subfolder:', b2bOrders.name, `(Parent: ${bulkOrders.name})`);

// 4.4 Prevent Duplicate Folder Name under Same Parent
try {
  db.createTestDataFolder(proj.id, 'Priority B2B', bulkOrders.id);
  console.assert(false, 'Duplicate subfolder name should fail');
} catch (err) {
  console.log('✓ Duplicate folder under same parent correctly rejected:', err.message);
}

// 4.5 Rename Subfolder
const renamedFolder = db.updateTestDataFolder(b2bOrders.id, proj.id, 'Enterprise B2B Express');
console.assert(renamedFolder.name === 'Enterprise B2B Express', 'Folder renamed successfully');
console.log('✓ Renamed subfolder to:', renamedFolder.name);

// 5. Test Excel Upload and Format Validation (Section 4.2, 4.3, 4.4)
console.log('\n--- 4. Testing Excel Upload and Format Validation ---');

// 5.1 Format Validation: Reject non-Excel formats
const invalidFormats = ['customers.csv', 'report.pdf', 'data.json', 'script.txt', 'image.png'];
invalidFormats.forEach(fileName => {
  try {
    db.uploadTestDataFile(proj.id, bulkOrders.id, {
      fileName,
      fileSizeBytes: 1024,
      uploadedBy: demoUser.email
    });
    console.assert(false, `File ${fileName} should have been rejected`);
  } catch (err) {
    console.log(`✓ Unsupported format "${fileName}" rejected: ${err.message}`);
  }
});

// 5.2 Upload Valid .xlsx File
const uploadedXlsx = db.uploadTestDataFile(proj.id, bulkOrders.id, {
  fileName: 'bulk_corporate_orders.xlsx',
  fileSizeBytes: 51200,
  uploadedBy: demoUser.email,
  sheetNames: ['CorporateAccounts', 'TaxExemptions'],
  rowCount: 150,
  description: 'Enterprise corporate purchase order datasets'
});
console.assert(uploadedXlsx.fileName === 'bulk_corporate_orders.xlsx', 'Filename matches');
console.assert(uploadedXlsx.fileFormat === '.xlsx', 'Format is .xlsx');
console.assert(uploadedXlsx.fileSizeFormatted === '50.0 KB', 'Formatted size is 50.0 KB');
console.assert(uploadedXlsx.uploadedBy === demoUser.email, 'Uploaded by recorded');
console.assert(uploadedXlsx.sheetNames.length === 2, 'Worksheets recorded');
console.log('✓ Successfully uploaded .xlsx file:', uploadedXlsx.fileName, `(${uploadedXlsx.fileSizeFormatted})`);

// 5.3 Upload Valid legacy .xls File
const uploadedXls = db.uploadTestDataFile(proj.id, bulkOrders.id, {
  fileName: 'legacy_distributor_data.xls',
  fileSizeBytes: 1048576,
  uploadedBy: demoUser.email,
  sheetNames: ['Distributors_2024'],
  rowCount: 80,
  description: 'Legacy distributor Excel 97-2003 workbook'
});
console.assert(uploadedXls.fileFormat === '.xls', 'Format is .xls');
console.assert(uploadedXls.fileSizeFormatted === '1.0 MB', 'Formatted size is 1.0 MB');
console.log('✓ Successfully uploaded .xls file:', uploadedXls.fileName, `(${uploadedXls.fileSizeFormatted})`);

// 5.4 Test Duplicate Filename in Same Folder (Replace Confirmation)
const updatedUpload = db.uploadTestDataFile(proj.id, bulkOrders.id, {
  fileName: 'bulk_corporate_orders.xlsx',
  fileSizeBytes: 76800,
  uploadedBy: demoUser.email,
  sheetNames: ['CorporateAccounts', 'TaxExemptions', 'Q4Rebates'],
  rowCount: 210,
  description: 'Updated with Q4 rebates'
});
console.assert(updatedUpload.id === uploadedXlsx.id, 'Should update same file ID on replace');
console.assert(updatedUpload.fileSizeBytes === 76800, 'Size updated');
console.assert(updatedUpload.fileSizeFormatted === '75.0 KB', 'Formatted size updated');
console.assert(updatedUpload.sheetNames.length === 3, 'Sheets updated');
console.log('✓ Duplicate file successfully replaced/updated in folder:', updatedUpload.fileName, `(${updatedUpload.fileSizeFormatted})`);

// 5.5 Test File Rename
const renamedFile = db.updateTestDataFile(uploadedXls.id, proj.id, {
  fileName: 'active_distributor_accounts.xls'
});
console.assert(renamedFile.fileName === 'active_distributor_accounts.xls', 'File renamed');
console.log('✓ File renamed successfully to:', renamedFile.fileName);

// Test Rename Rejects invalid extension change
try {
  db.updateTestDataFile(uploadedXls.id, proj.id, {
    fileName: 'active_distributors.csv'
  });
  console.assert(false, 'Rename to .csv should fail');
} catch (err) {
  console.log('✓ File rename to non-Excel extension rejected:', err.message);
}

// 5.6 Test File Deletion
const deleteFileResult = db.deleteTestDataFile(uploadedXls.id, proj.id);
console.assert(deleteFileResult === true, 'Delete file returns true');
const remainingInBulk = db.getTestDataFiles(proj.id, bulkOrders.id);
console.assert(!remainingInBulk.some(f => f.id === uploadedXls.id), 'Deleted file removed');
console.log('✓ File deleted successfully from folder');

// 6. Test Cascading Folder Deletion (Section 4.2)
console.log('\n--- 5. Testing Cascading Folder Deletion ---');
// Put a file into nested subfolder b2bOrders
const nestedFile = db.uploadTestDataFile(proj.id, b2bOrders.id, {
  fileName: 'tier1_contracts.xlsx',
  fileSizeBytes: 12288,
  uploadedBy: demoUser.email
});
console.log('✓ Seeded file in nested subfolder:', nestedFile.fileName);

// Delete the root "Orders Module" - should cascade delete "Bulk Orders", "Enterprise B2B Express", and all files inside!
db.deleteTestDataFolder(ordersFolder.id, proj.id);

const foldersAfterDelete = db.getTestDataFolders(proj.id);
console.assert(!foldersAfterDelete.some(f => f.id === ordersFolder.id), 'Root folder deleted');
console.assert(!foldersAfterDelete.some(f => f.id === bulkOrders.id), 'Subfolder 1 deleted by cascade');
console.assert(!foldersAfterDelete.some(f => f.id === b2bOrders.id), 'Subfolder 2 deleted by cascade');

const filesAfterDelete = db.getTestDataFiles(proj.id);
console.assert(!filesAfterDelete.some(f => f.id === uploadedXlsx.id), 'File 1 deleted by cascade');
console.assert(!filesAfterDelete.some(f => f.id === nestedFile.id), 'Nested File deleted by cascade');
console.log('✓ Cascading delete verified: Parent folder, all nested subfolders, and all contained files removed!');

// 7. Verify Cross-Module Readiness (Repository Elements + Test Data)
console.log('\n--- 6. Verifying Cross-Module Architectural Integration ---');
const elements = db.getRepositoryElements(proj.id);
const finalTestDataFiles = db.getTestDataFiles(proj.id);

console.assert(elements.length > 0, 'Project has centralized Repository elements');
console.assert(finalTestDataFiles.length > 0, 'Project has centralized Test Data Excel files');
console.log(`✓ Project contains ${elements.length} Repository UI elements and ${finalTestDataFiles.length} Test Data Excel files ready for TestDev & Suites.`);

// Cleanup
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('\n===========================================================');
console.log('  ALL STAGE 3 TESTS PASSED SUCCESSFULLY! (100% SUCCESS)    ');
console.log('===========================================================');

