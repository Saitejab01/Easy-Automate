export type NlpCategory =
  | 'Browser'
  | 'Browser Action'
  | 'Switching'
  | 'Verification'
  | 'Wait'
  | 'Scroll'
  | 'Excel';

export interface NlpDefinition {
  id: string;
  name: string;
  category: NlpCategory;
  description: string;
  requiresElement: boolean;
  requiredParams: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'dropdown' | 'file';
    description?: string;
    options?: string[];
    defaultValue?: any;
    placeholder?: string;
  }>;
  optionalParams?: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'dropdown';
    description?: string;
    options?: string[];
    defaultValue?: any;
    placeholder?: string;
  }>;
}

export const NLP_CATALOG: NlpDefinition[] = [
  // 4.1 Browser NLPs
  {
    id: 'open_browser',
    name: 'Open Browser',
    category: 'Browser',
    description: 'Launch the configured browser (Chromium, Firefox, or WebKit)',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'browser',
        label: 'Browser Engine',
        type: 'dropdown',
        options: ['Chromium', 'Firefox', 'WebKit'],
        defaultValue: 'Chromium'
      }
    ]
  },
  {
    id: 'navigate_to_url',
    name: 'Navigate To URL',
    category: 'Browser',
    description: 'Navigate to a specified URL in the active browser tab',
    requiresElement: false,
    requiredParams: [
      {
        name: 'url',
        label: 'Target URL',
        type: 'string',
        placeholder: 'https://demo.easyautomate.dev/login or $baseURL'
      }
    ]
  },
  {
    id: 'refresh_browser',
    name: 'Refresh Browser',
    category: 'Browser',
    description: 'Refresh the current page',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'close_browser',
    name: 'Close Browser',
    category: 'Browser',
    description: 'Close the browser and release resources',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'maximize_browser',
    name: 'Maximize Browser',
    category: 'Browser',
    description: 'Maximize the browser window',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'minimize_browser',
    name: 'Minimize Browser',
    category: 'Browser',
    description: 'Minimize the browser window',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'get_current_url',
    name: 'Get Current URL',
    category: 'Browser',
    description: 'Retrieve current URL and optionally store in variable',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'storeVariable', label: 'Store in Variable', type: 'string', placeholder: '$currentUrl' }]
  },
  {
    id: 'get_page_title',
    name: 'Get Page Title',
    category: 'Browser',
    description: 'Retrieve page title and optionally store in variable',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'storeVariable', label: 'Store in Variable', type: 'string', placeholder: '$pageTitle' }]
  },
  {
    id: 'navigate_back',
    name: 'Navigate Back',
    category: 'Browser',
    description: 'Navigate to the previous page',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'navigate_forward',
    name: 'Navigate Forward',
    category: 'Browser',
    description: 'Navigate to the next page',
    requiresElement: false,
    requiredParams: []
  },

  // 4.2 Browser Action NLPs
  {
    id: 'click_element',
    name: 'Click On Element',
    category: 'Browser Action',
    description: 'Click on a repository UI element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'double_click_element',
    name: 'Double Click On Element',
    category: 'Browser Action',
    description: 'Double click on a repository UI element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'right_click_element',
    name: 'Right Click On Element',
    category: 'Browser Action',
    description: 'Right click on a repository UI element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'enter_text',
    name: 'Enter Text',
    category: 'Browser Action',
    description: 'Enter text into an input field or textarea',
    requiresElement: true,
    requiredParams: [
      {
        name: 'text',
        label: 'Input Data / Value',
        type: 'string',
        placeholder: 'e.g. admin@demo.com or $username'
      }
    ],
    optionalParams: [
      {
        name: 'clearBeforeTyping',
        label: 'Clear Before Typing',
        type: 'boolean',
        defaultValue: true
      }
    ]
  },
  {
    id: 'clear_text',
    name: 'Clear Text',
    category: 'Browser Action',
    description: 'Clear content of editable element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'select_dropdown_by_text',
    name: 'Select Dropdown By Text',
    category: 'Browser Action',
    description: 'Select an option from dropdown using visible text',
    requiresElement: true,
    requiredParams: [
      {
        name: 'text',
        label: 'Option Text',
        type: 'string',
        placeholder: 'e.g. United States or $country'
      }
    ]
  },
  {
    id: 'select_dropdown_by_value',
    name: 'Select Dropdown By Value',
    category: 'Browser Action',
    description: 'Select an option from dropdown using option value',
    requiresElement: true,
    requiredParams: [
      {
        name: 'value',
        label: 'Option Value',
        type: 'string',
        placeholder: 'e.g. US or 100'
      }
    ]
  },
  {
    id: 'select_checkbox',
    name: 'Select Checkbox',
    category: 'Browser Action',
    description: 'Check a checkbox element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'deselect_checkbox',
    name: 'Deselect Checkbox',
    category: 'Browser Action',
    description: 'Uncheck a checkbox element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'upload_file',
    name: 'Upload File',
    category: 'Browser Action',
    description: 'Upload a file via a file input element',
    requiresElement: true,
    requiredParams: [
      {
        name: 'filePath',
        label: 'File Path or Test Data File',
        type: 'string',
        placeholder: 'e.g. valid_login_data.xlsx'
      }
    ]
  },
  {
    id: 'download_file',
    name: 'Download File',
    category: 'Browser Action',
    description: 'Trigger and capture a file download',
    requiresElement: false,
    requiredParams: [
      {
        name: 'downloadPath',
        label: 'Save Directory',
        type: 'string',
        defaultValue: './downloads'
      }
    ]
  },
  {
    id: 'press_keyboard_key',
    name: 'Press Keyboard Key',
    category: 'Browser Action',
    description: 'Press keyboard key',
    requiresElement: false,
    requiredParams: [
      {
        name: 'key',
        label: 'Keyboard Key',
        type: 'dropdown',
        options: ['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'Backspace', 'Delete', 'Control+A'],
        defaultValue: 'Enter'
      }
    ]
  },
  {
    id: 'hover_on_element',
    name: 'Hover On Element',
    category: 'Browser Action',
    description: 'Hover cursor over element',
    requiresElement: true,
    requiredParams: []
  },

  // 4.3 Switching NLPs
  {
    id: 'switch_to_frame',
    name: 'Switch To Frame',
    category: 'Switching',
    description: 'Switch execution context to the specified iframe',
    requiresElement: false,
    requiredParams: [{ name: 'frameIdentifier', label: 'Frame Selector / Name', type: 'string' }]
  },
  {
    id: 'switch_to_default_content',
    name: 'Switch To Default Content',
    category: 'Switching',
    description: 'Return execution context to main page',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_parent_frame',
    name: 'Switch To Parent Frame',
    category: 'Switching',
    description: 'Switch execution context to parent frame',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_new_tab',
    name: 'Switch To New Tab',
    category: 'Switching',
    description: 'Switch active context to newly opened tab',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_tab_by_title',
    name: 'Switch To Tab By Title',
    category: 'Switching',
    description: 'Switch to tab matching specified title',
    requiresElement: false,
    requiredParams: [{ name: 'tabTitle', label: 'Tab Title', type: 'string' }]
  },
  {
    id: 'switch_to_tab_by_url',
    name: 'Switch To Tab By URL',
    category: 'Switching',
    description: 'Switch to tab matching URL',
    requiresElement: false,
    requiredParams: [{ name: 'tabUrl', label: 'Tab URL', type: 'string' }]
  },
  {
    id: 'close_current_tab',
    name: 'Close Current Tab',
    category: 'Switching',
    description: 'Close active browser tab',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_alert',
    name: 'Switch To Alert',
    category: 'Switching',
    description: 'Handle browser dialog',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'accept_alert',
    name: 'Accept Alert',
    category: 'Switching',
    description: 'Accept the active alert dialog',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'dismiss_alert',
    name: 'Dismiss Alert',
    category: 'Switching',
    description: 'Dismiss the active alert dialog',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'get_alert_text',
    name: 'Get Alert Text',
    category: 'Switching',
    description: 'Retrieve alert message text and store in variable',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'storeVariable', label: 'Store in Variable', type: 'string', placeholder: '$alertMessage' }]
  },

  // 4.4 Verification / Assertion NLPs
  {
    id: 'verify_element_is_displayed',
    name: 'Verify Element Is Displayed',
    category: 'Verification',
    description: 'Verify that the repository element is visible on the page',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_not_displayed',
    name: 'Verify Element Is Not Displayed',
    category: 'Verification',
    description: 'Verify that the repository element is hidden or absent',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_enabled',
    name: 'Verify Element Is Enabled',
    category: 'Verification',
    description: 'Verify that the repository element is enabled',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_disabled',
    name: 'Verify Element Is Disabled',
    category: 'Verification',
    description: 'Verify that the repository element is disabled',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_text',
    name: 'Verify Text',
    category: 'Verification',
    description: 'Verify that the element contains expected text',
    requiresElement: true,
    requiredParams: [
      {
        name: 'expectedText',
        label: 'Expected Text',
        type: 'string',
        placeholder: 'e.g. Welcome back or $expectedGreeting'
      }
    ],
    optionalParams: [
      {
        name: 'exactMatch',
        label: 'Exact Match',
        type: 'boolean',
        defaultValue: false
      }
    ]
  },
  {
    id: 'verify_attribute',
    name: 'Verify Attribute',
    category: 'Verification',
    description: 'Verify element attribute name and value',
    requiresElement: true,
    requiredParams: [
      {
        name: 'attributeName',
        label: 'Attribute Name',
        type: 'string',
        placeholder: 'e.g. class, href, data-status'
      },
      {
        name: 'expectedValue',
        label: 'Expected Value',
        type: 'string',
        placeholder: 'e.g. active, /cart'
      }
    ]
  },
  {
    id: 'verify_url',
    name: 'Verify URL',
    category: 'Verification',
    description: 'Verify current page URL matches expected URL',
    requiresElement: false,
    requiredParams: [{ name: 'expectedUrl', label: 'Expected URL', type: 'string' }]
  },
  {
    id: 'verify_page_title',
    name: 'Verify Page Title',
    category: 'Verification',
    description: 'Verify browser title matches expected title',
    requiresElement: false,
    requiredParams: [{ name: 'expectedTitle', label: 'Expected Title', type: 'string' }]
  },
  {
    id: 'verify_checkbox_is_selected',
    name: 'Verify Checkbox Is Selected',
    category: 'Verification',
    description: 'Verify that checkbox element is checked',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_dropdown_value',
    name: 'Verify Dropdown Value',
    category: 'Verification',
    description: 'Verify that dropdown value matches expected value',
    requiresElement: true,
    requiredParams: [{ name: 'expectedValue', label: 'Expected Value', type: 'string' }]
  },

  // 4.5 Wait NLPs
  {
    id: 'wait_for_element',
    name: 'Wait For Element',
    category: 'Wait',
    description: 'Wait until element appears in DOM',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_element_to_be_visible',
    name: 'Wait For Element To Be Visible',
    category: 'Wait',
    description: 'Wait until element is visible',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_element_to_be_hidden',
    name: 'Wait For Element To Be Hidden',
    category: 'Wait',
    description: 'Wait until element is hidden',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_element_to_be_enabled',
    name: 'Wait For Element To Be Enabled',
    category: 'Wait',
    description: 'Wait until element is enabled',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_navigation',
    name: 'Wait For Navigation',
    category: 'Wait',
    description: 'Wait for page navigation',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_url',
    name: 'Wait For URL',
    category: 'Wait',
    description: 'Wait for a specific URL',
    requiresElement: false,
    requiredParams: [{ name: 'expectedUrl', label: 'Expected URL', type: 'string' }],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'wait_for_text',
    name: 'Wait For Text',
    category: 'Wait',
    description: 'Wait until expected text appears',
    requiresElement: false,
    requiredParams: [{ name: 'expectedText', label: 'Expected Text', type: 'string' }],
    optionalParams: [{ name: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }]
  },
  {
    id: 'static_wait',
    name: 'Static Wait',
    category: 'Wait',
    description: 'Wait for a specified duration',
    requiresElement: false,
    requiredParams: [{ name: 'durationMs', label: 'Duration (ms)', type: 'number', defaultValue: 2000 }]
  },

  // 4.6 Scroll NLPs
  {
    id: 'scroll_to_element',
    name: 'Scroll To Element',
    category: 'Scroll',
    description: 'Scroll until the element is visible',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'scroll_up',
    name: 'Scroll Up',
    category: 'Scroll',
    description: 'Scroll upwards',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'pixels', label: 'Pixels', type: 'number', defaultValue: 300 }]
  },
  {
    id: 'scroll_down',
    name: 'Scroll Down',
    category: 'Scroll',
    description: 'Scroll downwards',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [{ name: 'pixels', label: 'Pixels', type: 'number', defaultValue: 300 }]
  },
  {
    id: 'scroll_to_top',
    name: 'Scroll To Top',
    category: 'Scroll',
    description: 'Scroll to the top',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'scroll_to_bottom',
    name: 'Scroll To Bottom',
    category: 'Scroll',
    description: 'Scroll to the bottom',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'scroll_by_pixels',
    name: 'Scroll By Pixels',
    category: 'Scroll',
    description: 'Scroll by a specified pixel value',
    requiresElement: false,
    requiredParams: [
      { name: 'xPixels', label: 'X Offset', type: 'number', defaultValue: 0 },
      { name: 'yPixels', label: 'Y Offset', type: 'number', defaultValue: 500 }
    ]
  },

  // 4.7 Excel NLPs
  {
    id: 'get_data_from_excel',
    name: 'Get Data From Excel',
    category: 'Excel',
    description: 'Fetch test data using a unique identifier',
    requiresElement: false,
    requiredParams: [
      { name: 'fileName', label: 'Excel File', type: 'string', placeholder: 'e.g. valid_login_data.xlsx' },
      { name: 'sheetName', label: 'Worksheet Name', type: 'string', placeholder: 'e.g. Credentials' },
      { name: 'uniqueData', label: 'Unique Data', type: 'string', placeholder: 'e.g. TC001' }
    ],
    optionalParams: [
      { name: 'targetVariable', label: 'Store in Variable', type: 'string', placeholder: '$testData' }
    ]
  },
  {
    id: 'write_data_to_excel',
    name: 'Write Data To Excel',
    category: 'Excel',
    description: 'Update a particular cell using a unique identifier',
    requiresElement: false,
    requiredParams: [
      { name: 'fileName', label: 'Excel File', type: 'string', placeholder: 'e.g. valid_login_data.xlsx' },
      { name: 'sheetName', label: 'Worksheet Name', type: 'string', placeholder: 'e.g. Credentials' },
      { name: 'uniqueData', label: 'Unique Data', type: 'string', placeholder: 'e.g. TC001' },
      { name: 'header', label: 'Header', type: 'string', placeholder: 'e.g. ActualResult' },
      { name: 'writeBackData', label: 'Write Back Data', type: 'string', placeholder: 'e.g. Passed' }
    ]
  }
];
