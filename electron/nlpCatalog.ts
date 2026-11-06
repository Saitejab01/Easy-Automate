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
  // ================= 2. Browser NLPs (2.1 - 2.10) ================= //
  {
    id: 'open_browser',
    name: 'Open Browser',
    category: 'Browser',
    description: 'Launch the configured browser session (Chromium, Firefox, or WebKit)',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'browser',
        label: 'Browser Engine',
        type: 'dropdown',
        options: ['Chromium', 'Firefox', 'WebKit'],
        defaultValue: 'Chromium',
        description: 'Overrides script run settings browser'
      }
    ]
  },
  {
    id: 'close_browser',
    name: 'Close Browser',
    category: 'Browser',
    description: 'Close the browser and release system resources',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'maximize_browser',
    name: 'Maximize Browser',
    category: 'Browser',
    description: 'Maximize the browser window to fit the machine dimensions with 100% native zoom without scaling variation',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'minimize_browser',
    name: 'Minimize Browser',
    category: 'Browser',
    description: 'Minimize the browser window to taskbar',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'refresh_browser',
    name: 'Refresh Browser',
    category: 'Browser',
    description: 'Reload the current webpage',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'navigate_back',
    name: 'Navigate Back',
    category: 'Browser',
    description: 'Navigate to the previous page in history',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'navigate_forward',
    name: 'Navigate Forward',
    category: 'Browser',
    description: 'Navigate to the next page in history',
    requiresElement: false,
    requiredParams: []
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
        placeholder: 'https://demo.easyautomate.dev or $baseURL',
        description: 'Supports static URL or $variable reference'
      }
    ]
  },
  {
    id: 'get_current_url',
    name: 'Get Current URL',
    category: 'Browser',
    description: 'Retrieve current page URL and optionally store in variable',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'storeVariable',
        label: 'Store in Variable',
        type: 'string',
        placeholder: '$currentUrl',
        defaultValue: '$currentUrl'
      }
    ]
  },
  {
    id: 'get_page_title',
    name: 'Get Page Title',
    category: 'Browser',
    description: 'Retrieve current webpage title and optionally store in variable',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'storeVariable',
        label: 'Store in Variable',
        type: 'string',
        placeholder: '$pageTitle',
        defaultValue: '$pageTitle'
      }
    ]
  },

  // ================= 3. Browser Action NLPs (3.1 - 3.15) ================= //
  {
    id: 'click_element',
    name: 'Click On Element',
    category: 'Browser Action',
    description: 'Click on a repository UI element',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [
      {
        name: 'clickCount',
        label: 'Click Count',
        type: 'number',
        defaultValue: 1
      }
    ]
  },
  {
    id: 'double_click_element',
    name: 'Double Click On Element',
    category: 'Browser Action',
    description: 'Double-click on a repository UI element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'right_click_element',
    name: 'Right Click On Element',
    category: 'Browser Action',
    description: 'Right-click (context click) on a repository UI element',
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
        placeholder: 'e.g. admin@demo.com or $username',
        description: 'Supports plain text, masked secrets, or $variable substitution'
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
    description: 'Clear content of an input field or editable element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'mouse_hover',
    name: 'Mouse Hover',
    category: 'Browser Action',
    description: 'Hover mouse pointer over a repository UI element',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'drag_and_drop',
    name: 'Drag And Drop',
    category: 'Browser Action',
    description: 'Drag source element and drop onto target element or coordinate',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [
      {
        name: 'targetElementId',
        label: 'Target Element ID',
        type: 'string',
        placeholder: 'Target element in repository'
      },
      {
        name: 'targetX',
        label: 'Drop Offset X',
        type: 'number',
        defaultValue: 0
      },
      {
        name: 'targetY',
        label: 'Drop Offset Y',
        type: 'number',
        defaultValue: 0
      }
    ]
  },
  {
    id: 'select_dropdown_by_text',
    name: 'Select Dropdown By Text',
    category: 'Browser Action',
    description: 'Select an option from a dropdown using visible label text',
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
    description: 'Select an option from a dropdown using option value attribute',
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
    id: 'select_multiple_options',
    name: 'Select Multiple Options',
    category: 'Browser Action',
    description: 'Select multiple items in a multi-select dropdown',
    requiresElement: true,
    requiredParams: [
      {
        name: 'options',
        label: 'Options (comma separated)',
        type: 'string',
        placeholder: 'e.g. Red, Blue, Green'
      }
    ]
  },
  {
    id: 'select_checkbox',
    name: 'Select Checkbox',
    category: 'Browser Action',
    description: 'Ensure a checkbox element is checked',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'deselect_checkbox',
    name: 'Deselect Checkbox',
    category: 'Browser Action',
    description: 'Ensure a checkbox element is unchecked',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'press_keyboard_key',
    name: 'Press Keyboard Key',
    category: 'Browser Action',
    description: 'Simulate pressing a specific keyboard key (Enter, Tab, Escape, etc.)',
    requiresElement: false,
    requiredParams: [
      {
        name: 'key',
        label: 'Keyboard Key',
        type: 'dropdown',
        options: ['Enter', 'Tab', 'Escape', 'Backspace', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Space'],
        defaultValue: 'Enter'
      }
    ]
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
        placeholder: 'e.g. login_data.xlsx or C:/path/to/upload.pdf'
      }
    ]
  },
  {
    id: 'download_file',
    name: 'Download File',
    category: 'Browser Action',
    description: 'Click download trigger and capture file download path',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [
      {
        name: 'storeVariable',
        label: 'Store Path In Variable',
        type: 'string',
        placeholder: '$downloadedPath',
        defaultValue: '$downloadedPath'
      }
    ]
  },

  // ================= 4. Switching NLPs (4.1 - 4.11) ================= //
  {
    id: 'switch_to_frame',
    name: 'Switch To Frame',
    category: 'Switching',
    description: 'Switch context into an iframe by locator, name, or index',
    requiresElement: false,
    requiredParams: [
      {
        name: 'frameLocator',
        label: 'Frame Selector / Name / Index',
        type: 'string',
        placeholder: 'e.g. iframe#payment or 0 or frameName'
      }
    ]
  },
  {
    id: 'switch_to_default_content',
    name: 'Switch To Default Content',
    category: 'Switching',
    description: 'Switch back from iframe to top-level page content',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_parent_frame',
    name: 'Switch To Parent Frame',
    category: 'Switching',
    description: 'Switch context to immediate parent iframe',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_new_tab',
    name: 'Switch To New Tab',
    category: 'Switching',
    description: 'Switch focus to newly opened browser tab',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_tab_by_title',
    name: 'Switch To Tab By Title',
    category: 'Switching',
    description: 'Switch to a browser tab matching window title',
    requiresElement: false,
    requiredParams: [
      {
        name: 'tabTitle',
        label: 'Tab Title / Keyword',
        type: 'string',
        placeholder: 'e.g. Checkout or Dashboard'
      }
    ]
  },
  {
    id: 'switch_to_tab_by_url',
    name: 'Switch To Tab By URL',
    category: 'Switching',
    description: 'Switch to a browser tab matching URL pattern',
    requiresElement: false,
    requiredParams: [
      {
        name: 'tabUrl',
        label: 'Tab URL / Pattern',
        type: 'string',
        placeholder: 'e.g. https://checkout.demo.com'
      }
    ]
  },
  {
    id: 'close_current_tab',
    name: 'Close Current Tab',
    category: 'Switching',
    description: 'Close active browser tab and switch to remaining tab',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'switch_to_alert',
    name: 'Switch To Alert',
    category: 'Switching',
    description: 'Prepare to handle upcoming JavaScript dialog / alert',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'accept_alert',
    name: 'Accept Alert',
    category: 'Switching',
    description: 'Accept (OK) the active browser dialog / alert',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'dismiss_alert',
    name: 'Dismiss Alert',
    category: 'Switching',
    description: 'Dismiss (Cancel) the active browser dialog / alert',
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
    optionalParams: [
      {
        name: 'storeVariable',
        label: 'Store in Variable',
        type: 'string',
        placeholder: '$alertText',
        defaultValue: '$alertText'
      }
    ]
  },

  // ================= 5. Verification / Assertion NLPs (5.1 - 5.11) ================= //
  {
    id: 'verify_element_is_displayed',
    name: 'Verify Element Is Displayed',
    category: 'Verification',
    description: 'Verify that the repository element is visible in viewport',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_not_displayed',
    name: 'Verify Element Is Not Displayed',
    category: 'Verification',
    description: 'Verify that the repository element is hidden or invisible',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_present',
    name: 'Verify Element Is Present',
    category: 'Verification',
    description: 'Verify that the element exists in DOM tree',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_not_present',
    name: 'Verify Element Is Not Present',
    category: 'Verification',
    description: 'Verify that the element does not exist anywhere in DOM',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'verify_element_is_enabled',
    name: 'Verify Element Is Enabled',
    category: 'Verification',
    description: 'Verify that the repository element is enabled for user interaction',
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
    description: 'Verify text content within element or entire page',
    requiresElement: false,
    requiredParams: [
      {
        name: 'expectedText',
        label: 'Expected Text',
        type: 'string',
        placeholder: 'e.g. Order Placed or $expectedMessage'
      }
    ],
    optionalParams: [
      {
        name: 'comparisonType',
        label: 'Comparison Mode',
        type: 'dropdown',
        options: ['Contains', 'Equals', 'StartsWith', 'EndsWith'],
        defaultValue: 'Contains'
      }
    ]
  },
  {
    id: 'verify_attribute',
    name: 'Verify Attribute',
    category: 'Verification',
    description: 'Verify an element attribute value (e.g. href, class, data-status)',
    requiresElement: true,
    requiredParams: [
      {
        name: 'attributeName',
        label: 'Attribute Name',
        type: 'string',
        placeholder: 'e.g. class, href, data-id'
      },
      {
        name: 'expectedValue',
        label: 'Expected Value',
        type: 'string',
        placeholder: 'e.g. active or $status'
      }
    ]
  },
  {
    id: 'verify_page_title',
    name: 'Verify Page Title',
    category: 'Verification',
    description: 'Verify browser window title matches expected title',
    requiresElement: false,
    requiredParams: [
      {
        name: 'expectedTitle',
        label: 'Expected Page Title',
        type: 'string',
        placeholder: 'e.g. Dashboard - Easy Automate'
      }
    ]
  },
  {
    id: 'verify_current_url',
    name: 'Verify Current URL',
    category: 'Verification',
    description: 'Verify current page URL matches or contains expected URL',
    requiresElement: false,
    requiredParams: [
      {
        name: 'expectedUrl',
        label: 'Expected URL',
        type: 'string',
        placeholder: 'e.g. https://demo.easyautomate.dev/orders'
      }
    ]
  },
  {
    id: 'verify_dropdown_value',
    name: 'Verify Dropdown Value',
    category: 'Verification',
    description: 'Verify that the selected value of dropdown matches expected value',
    requiresElement: true,
    requiredParams: [
      {
        name: 'expectedValue',
        label: 'Expected Selected Value',
        type: 'string',
        placeholder: 'e.g. Active or $selectedValue'
      }
    ]
  },

  // ================= 6. Wait NLPs (6.1 - 6.8) ================= //
  // NOTE: Strictly adheres to Section 6: ALL Wait NLPs use Global Wait Settings!
  // NO individual timeout or wait-duration fields inside Wait NLP configurations!
  {
    id: 'wait_for_element_present',
    name: 'Wait For Element Present',
    category: 'Wait',
    description: 'Wait until element is attached in DOM using Global Wait Settings',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'wait_for_element_to_be_visible',
    name: 'Wait For Element To Be Visible',
    category: 'Wait',
    description: 'Wait until element becomes visible in viewport using Global Wait Settings',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'wait_for_element_clickable',
    name: 'Wait For Element Clickable',
    category: 'Wait',
    description: 'Wait until element is visible and enabled for click using Global Wait Settings',
    requiresElement: true,
    requiredParams: []
  },
  {
    id: 'wait_for_page_load',
    name: 'Wait For Page Load',
    category: 'Wait',
    description: 'Wait until DOM load and document readyState complete using Global Wait Settings',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'wait_for_network_idle',
    name: 'Wait For Network Idle',
    category: 'Wait',
    description: 'Wait until network requests settle to idle state using Global Wait Settings',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'static_wait',
    name: 'Static Wait',
    category: 'Wait',
    description: 'Pause execution momentarily using configured Step Delay in Run Settings',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'wait_for_text',
    name: 'Wait For Text Present',
    category: 'Wait',
    description: 'Wait until expected text appears on webpage using Global Wait Settings',
    requiresElement: false,
    requiredParams: [
      {
        name: 'expectedText',
        label: 'Expected Text',
        type: 'string',
        placeholder: 'e.g. Order Placed or $expectedStatus'
      }
    ]
  },
  {
    id: 'wait_for_element_to_be_hidden',
    name: 'Wait For Element Not Present',
    category: 'Wait',
    description: 'Wait until element disappears or is removed from DOM using Global Wait Settings',
    requiresElement: true,
    requiredParams: []
  },

  // ================= 7. Scroll NLPs (7.1 - 7.6) ================= //
  {
    id: 'scroll_to_element',
    name: 'Scroll To Element',
    category: 'Scroll',
    description: 'Scroll viewport until element is smoothly centered in view',
    requiresElement: true,
    requiredParams: [],
    optionalParams: [
      {
        name: 'alignTo',
        label: 'Alignment',
        type: 'dropdown',
        options: ['center', 'top', 'bottom'],
        defaultValue: 'center'
      }
    ]
  },
  {
    id: 'scroll_to_top',
    name: 'Scroll To Top',
    category: 'Scroll',
    description: 'Scroll viewport to top of page',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'scroll_to_bottom',
    name: 'Scroll To Bottom',
    category: 'Scroll',
    description: 'Scroll viewport to bottom of page',
    requiresElement: false,
    requiredParams: []
  },
  {
    id: 'scroll_up',
    name: 'Scroll Up',
    category: 'Scroll',
    description: 'Scroll window upwards by specified pixels',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'pixels',
        label: 'Pixels',
        type: 'number',
        defaultValue: 400
      }
    ]
  },
  {
    id: 'scroll_down',
    name: 'Scroll Down',
    category: 'Scroll',
    description: 'Scroll window downwards by specified pixels',
    requiresElement: false,
    requiredParams: [],
    optionalParams: [
      {
        name: 'pixels',
        label: 'Pixels',
        type: 'number',
        defaultValue: 400
      }
    ]
  },
  {
    id: 'scroll_by_pixels',
    name: 'Scroll By Pixels',
    category: 'Scroll',
    description: 'Scroll viewport by specific X and Y pixel offsets',
    requiresElement: false,
    requiredParams: [
      {
        name: 'xPixels',
        label: 'X Offset (Pixels)',
        type: 'number',
        defaultValue: 0
      },
      {
        name: 'yPixels',
        label: 'Y Offset (Pixels)',
        type: 'number',
        defaultValue: 400
      }
    ]
  },

  // ================= 8. Excel NLPs (8.1 - 8.2) ================= //
  {
    id: 'get_data_from_excel',
    name: 'Get Data From Excel',
    category: 'Excel',
    description: 'Fetch test data row from project Excel file matching TC_ID. Stores object in $testData and populates $testData.FieldName / $FieldName',
    requiresElement: false,
    requiredParams: [
      {
        name: 'fileName',
        label: 'Excel File (Test Data)',
        type: 'string',
        placeholder: 'e.g. login_data.xlsx'
      },
      {
        name: 'sheetName',
        label: 'Worksheet Name',
        type: 'string',
        placeholder: 'e.g. Credentials or Sheet1'
      },
      {
        name: 'uniqueData',
        label: 'Unique Data / TC_ID',
        type: 'string',
        placeholder: 'e.g. TC001'
      }
    ],
    optionalParams: [
      {
        name: 'targetVariable',
        label: 'Store Map In Variable',
        type: 'string',
        placeholder: '$testData',
        defaultValue: '$testData'
      }
    ]
  },
  {
    id: 'write_data_to_excel',
    name: 'Write Data To Excel',
    category: 'Excel',
    description: 'Update specific cell at the intersection of Unique Data (row) and Header (column)',
    requiresElement: false,
    requiredParams: [
      {
        name: 'fileName',
        label: 'Excel File (Test Data)',
        type: 'string',
        placeholder: 'e.g. login_data.xlsx'
      },
      {
        name: 'sheetName',
        label: 'Worksheet Name',
        type: 'string',
        placeholder: 'e.g. Credentials or Sheet1'
      },
      {
        name: 'uniqueData',
        label: 'Unique Data / TC_ID',
        type: 'string',
        placeholder: 'e.g. TC001'
      },
      {
        name: 'header',
        label: 'Target Column Header',
        type: 'string',
        placeholder: 'e.g. ActualResult or VerificationStatus'
      },
      {
        name: 'writeBackData',
        label: 'Write Back Data',
        type: 'string',
        placeholder: 'e.g. Passed or $status'
      }
    ]
  }
];
