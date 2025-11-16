import xmlrpc from 'xmlrpc';
import axios from 'axios';

/**
 * Authenticate with Odoo using XML-RPC
 * @param {string} url - Odoo instance URL
 * @param {string} dbName - Database name
 * @param {string} username - Username (email)
 * @param {string} password - Password
 * @returns {Promise<{success: boolean, uid?: number, error?: string}>}
 */
export async function authenticateOdoo(url, dbName, username, password) {
  try {
    // Clean URL - remove trailing slash
    const baseUrl = url.replace(/\/$/, '');
    
    // Try JSON-RPC first (more reliable)
    try {
      return await authenticateWithJSONRPC(baseUrl, dbName, username, password);
    } catch (jsonError) {
      console.log('JSON-RPC authentication failed, trying XML-RPC:', jsonError.message);
    }
    
    // Fallback to XML-RPC
    const urlObj = new URL(baseUrl);
    const isHttps = urlObj.protocol === 'https:';
    const port = urlObj.port || (isHttps ? 443 : 80);
    
    // Create XML-RPC client
    const client = isHttps 
      ? xmlrpc.createSecureClient({
          host: urlObj.hostname,
          port: port,
          path: '/xmlrpc/2/common',
          rejectUnauthorized: false // Allow self-signed certificates
        })
      : xmlrpc.createClient({
          host: urlObj.hostname,
          port: port,
          path: '/xmlrpc/2/common'
        });

    // Authenticate using XML-RPC
    return new Promise((resolve, reject) => {
      client.methodCall('authenticate', [dbName, username, password, {}], (error, uid) => {
        if (error) {
          console.error('XML-RPC authentication error:', error);
          resolve({ success: false, error: error.message || 'Authentication failed' });
        } else if (uid && uid !== false) {
          resolve({ success: true, uid });
        } else {
          resolve({ success: false, error: 'Invalid credentials' });
        }
      });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
}

/**
 * Authenticate with Odoo using JSON-RPC (fallback method)
 */
async function authenticateWithJSONRPC(url, dbName, username, password) {
  try {
    const response = await axios.post(`${url}/jsonrpc`, {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [dbName, username, password, {}]
      },
      id: Math.floor(Math.random() * 1000000)
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.result && response.data.result !== false) {
      return { success: true, uid: response.data.result };
    } else {
      return { success: false, error: 'Invalid credentials' };
    }
  } catch (error) {
    return { success: false, error: error.message || 'JSON-RPC authentication failed' };
  }
}

/**
 * Fetch sales orders from Odoo
 * @param {string} url - Odoo instance URL
 * @param {string} dbName - Database name
 * @param {string} username - Username (email)
 * @param {string} password - Password
 * @param {number} limit - Maximum number of records to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
 */
export async function fetchSalesOrders(url, dbName, username, password, limit = 100, offset = 0) {
  try {
    // First authenticate to get UID
    const authResult = await authenticateOdoo(url, dbName, username, password);
    
    if (!authResult.success || !authResult.uid) {
      return { success: false, error: 'Authentication failed' };
    }

    const uid = authResult.uid;
    const baseUrl = url.replace(/\/$/, '');

    // Try JSON-RPC first (more reliable for data fetching)
    try {
      return await fetchSalesWithJSONRPC(baseUrl, dbName, uid, password, limit, offset);
    } catch (jsonError) {
      console.log('JSON-RPC failed, trying XML-RPC:', jsonError.message);
      return await fetchSalesWithXMLRPC(baseUrl, dbName, uid, password, limit, offset);
    }
  } catch (error) {
    console.error('Fetch sales orders error:', error);
    return { success: false, error: error.message || 'Failed to fetch sales orders' };
  }
}

/**
 * Fetch sales orders using JSON-RPC
 */
async function fetchSalesWithJSONRPC(url, dbName, uid, password, limit, offset) {
  try {
    // Get count first
    const countResponse = await axios.post(`${url}/jsonrpc`, {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          dbName,
          uid,
          password,
          'sale.order',
          'search_count',
          [[]]
        ]
      },
      id: Math.floor(Math.random() * 1000000)
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const count = countResponse.data.result || 0;

    // Use search_read - combines search and read in one call, better for computed fields
    const readResponse = await axios.post(`${url}/jsonrpc`, {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          dbName,
          uid,
          password,
          'sale.order',
          'search_read',
          [[]],
          {
            fields: [
              'id',
              'name',
              'partner_id',
              'date_order',
              'amount_total',
              'amount_untaxed',
              'amount_tax',
              'state',
              'order_line',
              'user_id',
              'team_id',
              'currency_id',
              'client_order_ref',
              'note'
            ],
            limit,
            offset
          }
        ]
      },
      id: Math.floor(Math.random() * 1000000)
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const salesOrders = readResponse.data.result || [];

    // Debug logging
    if (salesOrders.length > 0) {
      console.log('Sample order from Odoo:', JSON.stringify(salesOrders[0], null, 2));
    }

    // Format the data for better readability
    const formattedOrders = salesOrders.map(order => {
      // Handle currency_id - it can be a tuple [id, name] or just an id
      let currencyName = 'INR';
      if (order.currency_id) {
        if (Array.isArray(order.currency_id) && order.currency_id.length > 1) {
          currencyName = order.currency_id[1];
        } else if (typeof order.currency_id === 'string') {
          currencyName = order.currency_id;
        }
      }

      // Handle amount_total - calculate from untaxed + tax if total is 0 or null
      let amountTotal = order.amount_total != null ? Number(order.amount_total) : 0;
      
      // If amount_total is 0 or null, try to calculate from amount_untaxed + amount_tax
      if (amountTotal === 0 || isNaN(amountTotal)) {
        const amountUntaxed = order.amount_untaxed != null ? Number(order.amount_untaxed) : 0;
        const amountTax = order.amount_tax != null ? Number(order.amount_tax) : 0;
        amountTotal = amountUntaxed + amountTax;
      }

      return {
      id: order.id,
      name: order.name,
      customer: order.partner_id ? order.partner_id[1] : 'N/A',
      customerId: order.partner_id ? order.partner_id[0] : null,
      date: order.date_order,
        total: amountTotal,
        amount: amountTotal, // Using amount_total instead of quantity
        currency: currencyName,
      state: order.state,
      salesperson: order.user_id ? order.user_id[1] : 'N/A',
      team: order.team_id ? order.team_id[1] : 'N/A',
      reference: order.client_order_ref || '',
      note: order.note || '',
      lineCount: order.order_line ? order.order_line.length : 0
      };
    });

    return {
      success: true,
      data: formattedOrders,
      count
    };
  } catch (error) {
    throw new Error(`JSON-RPC fetch failed: ${error.message}`);
  }
}

/**
 * Fetch sales orders using XML-RPC (fallback)
 */
function fetchSalesWithXMLRPC(url, dbName, uid, password, limit, offset) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const port = urlObj.port || (isHttps ? 443 : 80);
      
      const client = isHttps
        ? xmlrpc.createSecureClient({
            host: urlObj.hostname,
            port: port,
            path: '/xmlrpc/2/object',
            rejectUnauthorized: false
          })
        : xmlrpc.createClient({
            host: urlObj.hostname,
            port: port,
            path: '/xmlrpc/2/object'
          });

      // Search for sales order IDs
      client.methodCall('execute_kw', [
        dbName,
        uid,
        password,
        'sale.order',
        'search',
        [[]],
        { limit, offset }
      ], (error, orderIds) => {
        if (error) {
          reject(new Error(`XML-RPC search failed: ${error.message}`));
          return;
        }

        if (!orderIds || orderIds.length === 0) {
          resolve({ success: true, data: [], count: 0 });
          return;
        }

        // Get count
        client.methodCall('execute_kw', [
          dbName,
          uid,
          password,
          'sale.order',
          'search_count',
          [[]]
        ], (countError, count) => {
          if (countError) {
            console.warn('Count fetch failed:', countError);
          }

          // Read sales order details
          client.methodCall('execute_kw', [
            dbName,
            uid,
            password,
            'sale.order',
            'read',
            [orderIds],
            {
              fields: [
                'id',
                'name',
                'partner_id',
                'date_order',
                'amount_total',
                'amount_untaxed',
                'amount_tax',
                'state',
                'order_line',
                'user_id',
                'team_id',
                'currency_id',
                'client_order_ref',
                'note'
              ]
            }
          ], (readError, salesOrders) => {
            if (readError) {
              reject(new Error(`XML-RPC read failed: ${readError.message}`));
              return;
            }

            // Debug logging
            if (salesOrders && salesOrders.length > 0) {
              console.log('Sample order from Odoo (XML-RPC):', JSON.stringify(salesOrders[0], null, 2));
            }

            const formattedOrders = (salesOrders || []).map(order => {
              // Handle currency_id - it can be a tuple [id, name] or just an id
              let currencyName = 'INR';
              if (order.currency_id) {
                if (Array.isArray(order.currency_id) && order.currency_id.length > 1) {
                  currencyName = order.currency_id[1];
                } else if (typeof order.currency_id === 'string') {
                  currencyName = order.currency_id;
                }
              }

              // Handle amount_total - calculate from untaxed + tax if total is 0 or null
              let amountTotal = order.amount_total != null ? Number(order.amount_total) : 0;
              
              // If amount_total is 0 or null, try to calculate from amount_untaxed + amount_tax
              if (amountTotal === 0 || isNaN(amountTotal)) {
                const amountUntaxed = order.amount_untaxed != null ? Number(order.amount_untaxed) : 0;
                const amountTax = order.amount_tax != null ? Number(order.amount_tax) : 0;
                amountTotal = amountUntaxed + amountTax;
              }

              return {
              id: order.id,
              name: order.name,
              customer: order.partner_id ? order.partner_id[1] : 'N/A',
              customerId: order.partner_id ? order.partner_id[0] : null,
              date: order.date_order,
                total: amountTotal,
                amount: amountTotal, // Using amount_total instead of quantity
                currency: currencyName,
              state: order.state,
              salesperson: order.user_id ? order.user_id[1] : 'N/A',
              team: order.team_id ? order.team_id[1] : 'N/A',
              reference: order.client_order_ref || '',
              note: order.note || '',
              lineCount: order.order_line ? order.order_line.length : 0
              };
            });

            resolve({
              success: true,
              data: formattedOrders,
              count: count || formattedOrders.length
            });
          });
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

