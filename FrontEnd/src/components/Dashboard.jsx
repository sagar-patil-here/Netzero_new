import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  Mail,
  Calendar,
  TrendingUp,
  Camera,
  X,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import Navbar from "./Navbar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const Dashboard = () => {
  const { currentUser, assignAvatar, loading } = useAuth();
  const [avatarError, setAvatarError] = React.useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState(false);
  const [isErpModalOpen, setIsErpModalOpen] = React.useState(false);
  const [selectedSourceType, setSelectedSourceType] = React.useState(null);
  const [selectedErpSystem, setSelectedErpSystem] = React.useState(null);
  const [selectedApiMethod, setSelectedApiMethod] = React.useState(null);
  const [apiFormData, setApiFormData] = React.useState({
    url: "",
    apiKey: "",
    secret: "",
    username: "",
    password: "",
    dbName: "",
  });
  const [connectionLoading, setConnectionLoading] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState("");
  const [connectionData, setConnectionData] = React.useState(null);
  const [salesData, setSalesData] = React.useState(null);
  const [salesLoading, setSalesLoading] = React.useState(false);
  const [odooCredentials, setOdooCredentials] = React.useState(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = React.useState(false);
  const [co2Data, setCo2Data] = React.useState([]);

  const userInitial = React.useMemo(() => {
    const source = currentUser?.displayName || currentUser?.email || "";
    return source.trim().charAt(0).toUpperCase() || "U";
  }, [currentUser]);

  const hasProfileImage = Boolean(currentUser?.photoURL) && !avatarError;

  React.useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.photoURL]);

  const fetchSalesData = React.useCallback(async (credentials = null) => {
    const creds = credentials || odooCredentials;
    if (!creds) return;

    setSalesLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/odoo/sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: creds.url,
          dbName: creds.dbName,
          username: creds.username,
          password: creds.password,
          limit: 100,
          offset: 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch sales data");
      }

      if (data.success) {
        setSalesData(data);
        
        // Save sales data to localStorage
        if (currentUser) {
          localStorage.setItem(`odoo_sales_${currentUser.uid}`, JSON.stringify(data));
        }
      } else {
        throw new Error(data.error || "Failed to fetch sales data");
      }
    } catch (error) {
      console.error("Fetch sales error:", error);
      // Don't set connection error here, just log it
    } finally {
      setSalesLoading(false);
    }
  }, [currentUser, odooCredentials]);

  // Function to reconnect to Odoo with saved credentials
  const reconnectOdoo = React.useCallback(async (credentials) => {
    if (!credentials) return;

    try {
      // Test connection
      const response = await fetch(`${API_BASE_URL}/api/odoo/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: credentials.url,
          dbName: credentials.dbName,
          username: credentials.username,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionData(data);
        // Save connection data
        if (currentUser) {
          localStorage.setItem(`odoo_connection_${currentUser.uid}`, JSON.stringify(data));
        }
        // Fetch fresh sales data
        await fetchSalesData(credentials);
      } else {
        // Connection failed, clear saved credentials
        if (currentUser) {
          localStorage.removeItem(`odoo_credentials_${currentUser.uid}`);
          localStorage.removeItem(`odoo_connection_${currentUser.uid}`);
          localStorage.removeItem(`odoo_sales_${currentUser.uid}`);
        }
        setOdooCredentials(null);
        setConnectionData(null);
        setSalesData(null);
      }
    } catch (error) {
      console.error("Error reconnecting to Odoo:", error);
      // Don't clear credentials on network errors, might be temporary
    }
  }, [currentUser, fetchSalesData]);

  // Function to disconnect and clear saved credentials
  const disconnectOdoo = () => {
    if (currentUser) {
      localStorage.removeItem(`odoo_credentials_${currentUser.uid}`);
      localStorage.removeItem(`odoo_connection_${currentUser.uid}`);
      localStorage.removeItem(`odoo_sales_${currentUser.uid}`);
    }
    setOdooCredentials(null);
    setConnectionData(null);
    setSalesData(null);
  };

  // Load saved credentials and connection data from localStorage on mount
  React.useEffect(() => {
    if (currentUser) {
      const savedCredentials = localStorage.getItem(`odoo_credentials_${currentUser.uid}`);
      const savedConnectionData = localStorage.getItem(`odoo_connection_${currentUser.uid}`);
      const savedSalesData = localStorage.getItem(`odoo_sales_${currentUser.uid}`);

      if (savedCredentials) {
        try {
          const credentials = JSON.parse(savedCredentials);
          setOdooCredentials(credentials);
          
          // Restore connection data if available
          if (savedConnectionData) {
            const connection = JSON.parse(savedConnectionData);
            setConnectionData(connection);
          }

          // Restore sales data if available
          if (savedSalesData) {
            const sales = JSON.parse(savedSalesData);
            setSalesData(sales);
          }

          // Automatically reconnect and fetch fresh data
          if (credentials) {
            reconnectOdoo(credentials);
          }
        } catch (error) {
          console.error("Error loading saved credentials:", error);
          // Clear corrupted data
          localStorage.removeItem(`odoo_credentials_${currentUser.uid}`);
          localStorage.removeItem(`odoo_connection_${currentUser.uid}`);
          localStorage.removeItem(`odoo_sales_${currentUser.uid}`);
        }
      }
    }
  }, [currentUser, reconnectOdoo]);

  const openConnectModal = () => {
    setSelectedSourceType(null);
    setSelectedErpSystem(null);
    setSelectedApiMethod(null);
    setApiFormData({
      url: "",
      apiKey: "",
      secret: "",
      username: "",
      password: "",
      dbName: "",
    });
    setIsConnectModalOpen(true);
  };

  const closeConnectModal = () => {
    setIsConnectModalOpen(false);
    setSelectedSourceType(null);
    setSelectedErpSystem(null);
    setSelectedApiMethod(null);
    setApiFormData({
      url: "",
      apiKey: "",
      secret: "",
      username: "",
      password: "",
      dbName: "",
    });
    setConnectionError("");
    // Don't clear connectionData and salesData - keep them for dashboard display
    setConnectionLoading(false);
  };

  const handleSourceTypeSelect = (type) => {
    setSelectedSourceType(type);
    setSelectedErpSystem(null);
    setSelectedApiMethod(null);
    setApiFormData({
      url: "",
      apiKey: "",
      secret: "",
      username: "",
      password: "",
      dbName: "",
    });
    setConnectionError("");
    setConnectionData(null);
  };

  const handleErpSystemSelect = (erpSystem) => {
    // If NetZero ERP is selected, redirect to the NetZero ERP website
    if (erpSystem === "NETZERO_ERP") {
      window.open("https://net-zero-erp.vercel.app", "_blank");
      return;
    }
    
    setSelectedErpSystem(erpSystem);
    setSelectedApiMethod(null);
    setApiFormData({
      url: "",
      apiKey: "",
      secret: "",
      username: "",
      password: "",
      dbName: "",
    });
    setConnectionError("");
    setConnectionData(null);
  };

  const handleApiMethodSelect = (method) => {
    setSelectedApiMethod(method);
    setApiFormData({
      url: "",
      apiKey: "",
      secret: "",
      username: "",
      password: "",
      dbName: "",
    });
    setConnectionError("");
    setConnectionData(null);
  };

  const handleApiFormChange = (field) => (e) => {
    setApiFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleApiConnect = async (e) => {
    e.preventDefault();
    setConnectionLoading(true);
    setConnectionError("");
    setConnectionData(null);
    setSalesData(null);

    try {
      // Handle Odoo connection differently
      if (selectedErpSystem === "ODOO") {
        if (
          !apiFormData.url ||
          !apiFormData.dbName ||
          !apiFormData.username ||
          !apiFormData.password
        ) {
          setConnectionError(
            "Please fill in all required fields: URL, DB Name, Username, and Password."
          );
          setConnectionLoading(false);
          return;
        }

        // Connect to Odoo
        const response = await fetch(`${API_BASE_URL}/api/odoo/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: apiFormData.url,
            dbName: apiFormData.dbName,
            username: apiFormData.username,
            password: apiFormData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to connect to Odoo");
        }

          if (data.success) {
            setConnectionData(data);
            // Store credentials for future use
            const credentials = {
              url: apiFormData.url,
              dbName: apiFormData.dbName,
              username: apiFormData.username,
              password: apiFormData.password,
            };
            setOdooCredentials(credentials);
            
            // Save credentials and connection data to localStorage
            if (currentUser) {
              localStorage.setItem(`odoo_credentials_${currentUser.uid}`, JSON.stringify(credentials));
              localStorage.setItem(`odoo_connection_${currentUser.uid}`, JSON.stringify(data));
            }
            
            // Automatically fetch sales data after successful connection
            await fetchSalesData(credentials);
            // Close modal after successful connection and data fetch
            setTimeout(() => {
              closeConnectModal();
            }, 1000);
          } else {
            throw new Error(data.error || "Connection failed");
          }
      } else {
        // Handle other ERP systems (ERPNext, etc.)
        let secret = "";

        // Prepare secret based on connection method
        if (selectedApiMethod === "URL") {
          // For URL only, we might not need secret, but ERPNext requires it
          setConnectionError(
            "ERPNext requires authentication. Please use Key-Secret or Username & Password."
          );
          setConnectionLoading(false);
          return;
        } else if (selectedApiMethod === "URL_SECRET") {
          if (!apiFormData.apiKey || !apiFormData.secret) {
            setConnectionError("Please fill in both API Key and Secret.");
            setConnectionLoading(false);
            return;
          }
          secret = `${apiFormData.apiKey}:${apiFormData.secret}`;
        } else if (selectedApiMethod === "USER_PASS") {
          // For username/password, we need to format it as api_key:api_secret
          // In ERPNext, this would typically be handled differently, but for now we'll use the format
          secret = `${apiFormData.username}:${apiFormData.password}`;
        }

        if (!apiFormData.url || !secret) {
          setConnectionError("Please fill in all required fields.");
          setConnectionLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/erp/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: apiFormData.url,
            secret: secret,
            erpSystem: selectedErpSystem,
            connectionMethod: selectedApiMethod,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to connect to ERP system");
        }

        if (data.success) {
          setConnectionData(data);
        } else {
          throw new Error(data.error || "Connection failed");
        }
      }
    } catch (error) {
      console.error("Connection error:", error);

      // Handle different types of errors
      if (error.message === "Failed to fetch" || error.name === "TypeError") {
        setConnectionError(
          "Cannot connect to backend server. Please ensure:\n" +
            "1. Backend server is running on http://localhost:5000\n" +
            '2. Run "npm start" in the BackEnd directory\n' +
            "3. Check browser console for CORS errors"
        );
      } else {
        setConnectionError(
          error.message ||
            "Failed to connect. Please check your credentials and try again."
        );
      }
    } finally {
      setConnectionLoading(false);
    }
  };


  const handleNetzeroErpClick = () => {
    setIsErpModalOpen(true);
  };

  const closeErpModal = () => {
    setIsErpModalOpen(false);
  };

  // Generate CO2 emission data based on order count
  const generateCO2Data = (orderCount) => {
    if (!orderCount || orderCount === 0) return [];

    const data = [];
    // Generate data points based on order count (more orders = more data points)
    const dataPoints = Math.min(orderCount, 12); // Max 12 months/points

    for (let i = 0; i < dataPoints; i++) {
      // Generate random CO2 emissions (in kg CO2e) that scale with order count
      // Base emission per order: 10-50 kg CO2e, with some variation
      const baseEmission =
        (orderCount / dataPoints) * (10 + Math.random() * 40);
      const randomVariation = (Math.random() - 0.5) * 20; // ±10 kg variation
      const emission = Math.max(0, baseEmission + randomVariation);

      data.push({
        month: `Month ${i + 1}`,
        emission: Math.round(emission * 100) / 100, // Round to 2 decimal places
        orders:
          Math.floor(orderCount / dataPoints) + Math.floor(Math.random() * 3),
      });
    }

    return data;
  };

  const handleAnalysisClick = () => {
    if (salesData && salesData.count > 0) {
      const emissionData = generateCO2Data(salesData.count);
      setCo2Data(emissionData);
      setIsAnalysisModalOpen(true);
    }
  };

  const closeAnalysisModal = () => {
    setIsAnalysisModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">No user logged in</div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-black"
      >
        <Navbar />
        <div className="container mx-auto px-6 pt-20">
          <div className="max-w-4xl mx-auto">
            {/* Welcome Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                Welcome to NetZero
              </h1>
              <p className="text-xl text-gray-400">
                Your carbon tracking dashboard
              </p>
            </motion.div>

            {/* User Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8 border border-white/10"
            >
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                    {hasProfileImage ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span className="text-2xl font-semibold text-white">
                        {userInitial}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {currentUser.displayName || "User"}
                  </h2>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{currentUser.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 mt-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Member since{" "}
                      {new Date(
                        currentUser.metadata.creationTime
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  {hasProfileImage ? (
                    <div className="flex items-center gap-2 text-green-400 mt-2">
                      <Camera className="w-3 h-3" />
                      <span className="text-xs">Profile photo</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-400 mt-2">
                      <Camera className="w-3 h-3" />
                      <span className="text-xs">
                        Initial placeholder avatar
                      </span>
                      <button
                        onClick={() => assignAvatar()}
                        className="ml-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30 transition-colors"
                      >
                        Assign Default Avatar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            >
              <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 backdrop-blur-sm rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">0</p>
                    <p className="text-sm text-gray-400">
                      Carbon Footprint (kg CO₂)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {salesData?.count || 0}
                    </p>
                    <p className="text-sm text-gray-400">Sales Orders</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">0%</p>
                    <p className="text-sm text-gray-400">Reduction Achieved</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Odoo Sales Data Section */}
            {salesData && salesData.data && salesData.data.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 mb-8"
              >
                 <div className="flex items-center justify-between mb-6">
                   <div>
                     <h3 className="text-2xl font-bold text-white mb-2">
                       Odoo Sales Orders
                     </h3>
                     <p className="text-gray-400 text-sm">
                       Connected to:{" "}
                       {connectionData?.authenticatedUser || "Odoo"}
                     </p>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => fetchSalesData()}
                       disabled={salesLoading}
                       className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <RefreshCw
                         className={`w-4 h-4 ${
                           salesLoading ? "animate-spin" : ""
                         }`}
                       />
                       {salesLoading ? "Refreshing..." : "Refresh"}
                     </button>
                     <button
                       onClick={disconnectOdoo}
                       className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-sm font-medium"
                       title="Disconnect and clear saved credentials"
                     >
                       <X className="w-4 h-4" />
                       Disconnect
                     </button>
                   </div>
                 </div>

                {salesLoading && !salesData.data && (
                  <div className="text-center py-8 text-gray-400">
                    Loading sales data...
                  </div>
                )}

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {salesData.data.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-white text-lg mb-1">
                            {order.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            Customer: {order.customer}
                          </div>
                          {order.reference && (
                            <div className="text-xs text-gray-500 mt-1">
                              Reference: {order.reference}
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.state === "sale"
                              ? "bg-green-500/20 text-green-300 border border-green-500/30"
                              : order.state === "draft"
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                              : order.state === "cancel"
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                          }`}
                        >
                          {order.state?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs mb-1">Date</div>
                          <div className="text-white">
                            {new Date(order.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs mb-1">
                            Salesperson
                          </div>
                          <div className="text-white">{order.salesperson}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs mb-1">
                            Order Lines
                          </div>
                          <div className="text-white">
                            {order.lineCount} lines
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {salesData.count > salesData.data.length && (
                  <div className="mt-4 text-center text-sm text-gray-400">
                    Showing {salesData.data.length} of {salesData.count} orders
                  </div>
                )}

                {/* Analyses Button */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleAnalysisClick}
                    disabled={!salesData || salesData.count === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <BarChart3 className="w-5 h-5" />
                    View CO2 Emissions Analysis
                  </button>
                </div>
              </motion.div>
            )}

            {/* Getting Started */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
            >
              <h3 className="text-2xl font-bold text-white mb-4">
                Getting Started
              </h3>
              <p className="text-gray-400 mb-6">
                Welcome to NetZero! Start tracking your carbon footprint by
                adding your first project or connecting your data sources.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={openConnectModal}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  {odooCredentials
                    ? "Reconnect Data Source"
                    : "Connect Data Source"}
                </button>
                <button
                  onClick={() => {
                    window.open("https://net-zero-erp.vercel.app", "_blank");
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Netzero-ERP
                </button>
                <button className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors">
                  View Tutorial
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-[#111] border border-white/10 p-6">
            <button
              onClick={closeConnectModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {!selectedSourceType && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Select a data source type
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Choose how you would like to bring project data into
                    NetZero.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "API", label: "ERP API Integration" },
                    { key: "SQL", label: "SQL Database" },
                    { key: "NOSQL", label: "No-SQL Database" },
                    { key: "IOT", label: "IoT System" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleSourceTypeSelect(option.key)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white hover:border-white/30 transition"
                    >
                      <span className="block text-sm font-medium text-white">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-400 mt-1">
                        {option.key === "API"
                          ? "Connect via REST/GraphQL endpoints."
                          : option.key === "SQL"
                          ? "Sync from relational databases."
                          : option.key === "NOSQL"
                          ? "Integrate document or key-value stores."
                          : "Collect telemetry from connected devices."}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSourceType && selectedSourceType !== "API" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {selectedSourceType === "SQL"
                        ? "SQL Database"
                        : selectedSourceType === "NOSQL"
                        ? "No-SQL Database"
                        : "IoT System"}{" "}
                      integration
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Support for this connector is coming soon. Stay tuned!
                    </p>
                  </div>
                  <button
                    onClick={() => handleSourceTypeSelect(null)}
                    className="text-sm text-gray-300 hover:text-white transition"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {selectedSourceType === "API" && !selectedErpSystem && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Select ERP System
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Choose the ERP system you want to connect with.
                    </p>
                  </div>
                  <button
                    onClick={() => handleSourceTypeSelect(null)}
                    className="text-sm text-gray-300 hover:text-white transition"
                  >
                    Back
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      key: "NETZERO_ERP",
                      label: "NetZero ERP",
                      description:
                        "Our integrated ERP solution for carbon tracking.",
                    },
                    {
                      key: "ERPNEXT",
                      label: "ERPNext",
                      description:
                        "Open-source ERP system with comprehensive business management.",
                    },
                    {
                      key: "ODOO",
                      label: "Odoo",
                      description:
                        "All-in-one business management software suite.",
                    },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleErpSystemSelect(option.key)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedErpSystem === option.key
                          ? "border-white/60 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-gray-200 hover:border-white/40"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="block text-xs text-gray-400 mt-1">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSourceType === "API" &&
              selectedErpSystem &&
              selectedErpSystem !== "ODOO" &&
              !selectedApiMethod && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Connection Method
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Choose how to authenticate with{" "}
                        {selectedErpSystem === "NETZERO_ERP"
                          ? "NetZero ERP"
                          : "ERPNext"}
                        .
                      </p>
                    </div>
                    <button
                      onClick={() => handleErpSystemSelect(null)}
                      className="text-sm text-gray-300 hover:text-white transition"
                    >
                      Back
                    </button>
                  </div>

                  <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 mb-4">
                    Selected ERP:{" "}
                    <span className="font-semibold text-white">
                      {selectedErpSystem === "NETZERO_ERP"
                        ? "NetZero ERP"
                        : "ERPNext"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        key: "URL",
                        label: "URL only",
                        description: "Public or pre-authorised endpoints.",
                      },
                      {
                        key: "URL_SECRET",
                        label: "Key-Secret",
                        description:
                          "Endpoints protected with API keys or tokens.",
                      },
                      {
                        key: "USER_PASS",
                        label: "Username & Password",
                        description:
                          "Basic auth or legacy service credentials.",
                      },
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() => handleApiMethodSelect(option.key)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          selectedApiMethod === option.key
                            ? "border-white/60 bg-white/10 text-white"
                            : "border-white/10 bg-white/5 text-gray-200 hover:border-white/40"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="block text-xs text-gray-400 mt-1">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {selectedSourceType === "API" && selectedErpSystem === "ODOO" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Odoo Connection Details
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Enter your Odoo credentials to connect.
                    </p>
                  </div>
                  <button
                    onClick={() => handleErpSystemSelect(null)}
                    className="text-sm text-gray-300 hover:text-white transition"
                  >
                    Back
                  </button>
                </div>

                <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                  Selected ERP:{" "}
                  <span className="font-semibold text-white">Odoo</span>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-white/10"
                >
                  {connectionError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 whitespace-pre-line">
                      {connectionError}
                    </div>
                  )}

                  {connectionData && (
                    <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200 space-y-3">
                      <div className="font-semibold text-white">
                        Connection Successful!
                      </div>
                      <div>
                        Authenticated as:{" "}
                        <span className="font-medium">
                          {connectionData.authenticatedUser}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        Fetching sales data... The modal will close
                        automatically.
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleApiConnect} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-300">
                        Odoo URL <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="url"
                        value={apiFormData.url}
                        onChange={handleApiFormChange("url")}
                        placeholder="https://your-odoo-instance.com"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your Odoo instance base URL (e.g.,
                        https://demo.odoo.com)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-300">
                        Database Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={apiFormData.dbName}
                        onChange={handleApiFormChange("dbName")}
                        placeholder="mycompany_db"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Found in Settings → General Settings → Database
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-300">
                        Username (Email) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={apiFormData.username}
                        onChange={handleApiFormChange("username")}
                        placeholder="apiuser@domain.com"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your Odoo user email address
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-300">
                        Password <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="password"
                        value={apiFormData.password}
                        onChange={handleApiFormChange("password")}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your Odoo user password
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleErpSystemSelect(null)}
                        className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={connectionLoading}
                        className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {connectionLoading ? "Connecting..." : "Connect"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}

            {selectedSourceType === "API" &&
              selectedErpSystem &&
              selectedErpSystem !== "ODOO" &&
              selectedApiMethod && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Connection Details
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Enter your connection credentials.
                      </p>
                    </div>
                    <button
                      onClick={() => handleApiMethodSelect(null)}
                      className="text-sm text-gray-300 hover:text-white transition"
                    >
                      Back
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                      ERP System:{" "}
                      <span className="font-semibold text-white">
                        {selectedErpSystem === "NETZERO_ERP"
                          ? "NetZero ERP"
                          : selectedErpSystem === "ERPNEXT"
                          ? "ERPNext"
                          : "Odoo"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                      Connection Method:{" "}
                      <span className="font-semibold text-white">
                        {selectedApiMethod === "URL"
                          ? "URL only"
                          : selectedApiMethod === "URL_SECRET"
                          ? "Key-Secret"
                          : "Username & Password"}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-4 border-t border-white/10"
                  >
                    {connectionError && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 whitespace-pre-line">
                        {connectionError}
                      </div>
                    )}

                    {connectionData && (
                      <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200 space-y-3">
                        <div className="font-semibold text-white">
                          Connection Successful!
                        </div>
                        <div>
                          Authenticated as:{" "}
                          <span className="font-medium">
                            {connectionData.authenticatedUser}
                          </span>
                        </div>
                        {selectedErpSystem === "ODOO" && salesData && (
                          <div className="pt-2 border-t border-green-500/30 space-y-2">
                            <div className="font-semibold text-white">
                              Sales Orders: {salesData.count || 0}
                            </div>
                            {salesLoading && (
                              <div className="text-xs text-gray-400">
                                Loading sales data...
                              </div>
                            )}
                          </div>
                        )}
                        {connectionData.summary && (
                          <div className="pt-2 border-t border-green-500/30 space-y-1 text-xs">
                            <div>
                              Sales Orders:{" "}
                              {connectionData.summary.totalSalesOrders}
                            </div>
                            <div>
                              Purchase Orders:{" "}
                              {connectionData.summary.totalPurchaseOrders}
                            </div>
                            <div>
                              Items: {connectionData.summary.totalItems}
                            </div>
                            <div>
                              Customers: {connectionData.summary.totalCustomers}
                            </div>
                            <div>
                              Suppliers: {connectionData.summary.totalSuppliers}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {salesData &&
                      salesData.data &&
                      salesData.data.length > 0 && (
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
                          <div className="font-semibold text-white text-sm">
                            Sales Orders ({salesData.count})
                          </div>
                          <div className="space-y-2">
                            {salesData.data.map((order) => (
                              <div
                                key={order.id}
                                className="bg-white/5 rounded-lg p-3 border border-white/10"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-medium text-white text-sm">
                                      {order.name}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      Customer: {order.customer}
                                    </div>
                                  </div>
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      order.state === "sale"
                                        ? "bg-green-500/20 text-green-300"
                                        : order.state === "draft"
                                        ? "bg-yellow-500/20 text-yellow-300"
                                        : order.state === "cancel"
                                        ? "bg-red-500/20 text-red-300"
                                        : "bg-gray-500/20 text-gray-300"
                                    }`}
                                  >
                                    {order.state}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                  <div>
                                    Date:{" "}
                                    {new Date(order.date).toLocaleDateString()}
                                  </div>
                                  <div className="text-right">
                                    Total: {order.total} {order.currency}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <form onSubmit={handleApiConnect} className="space-y-4">
                      {selectedApiMethod === "URL" && (
                        <div className="space-y-2">
                          <label className="text-sm text-gray-300">
                            API URL <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="url"
                            value={apiFormData.url}
                            onChange={handleApiFormChange("url")}
                            placeholder="https://api.example.com/endpoint"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                            required
                          />
                        </div>
                      )}

                      {selectedApiMethod === "URL_SECRET" && (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm text-gray-300">
                              Base URL <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="url"
                              value={apiFormData.url}
                              onChange={handleApiFormChange("url")}
                              placeholder="https://your-erpnext-instance.com"
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                              required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Your ERPNext instance base URL (e.g.,
                              https://demo.erpnext.com)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-gray-300">
                              API Key <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={apiFormData.apiKey}
                              onChange={handleApiFormChange("apiKey")}
                              placeholder="Enter your API key"
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                              required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Found in User Settings → API Access section
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-gray-300">
                              API Secret <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="password"
                              value={apiFormData.secret}
                              onChange={handleApiFormChange("secret")}
                              placeholder="Enter your API secret"
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                              required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Generated when you click "Generate Keys" in API
                              Access section
                            </p>
                          </div>
                        </>
                      )}

                      {selectedApiMethod === "USER_PASS" &&
                        selectedErpSystem !== "ODOO" && (
                          <>
                            <div className="space-y-2">
                              <label className="text-sm text-gray-300">
                                Username <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={apiFormData.username}
                                onChange={handleApiFormChange("username")}
                                placeholder="Enter your username"
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm text-gray-300">
                                Password <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="password"
                                value={apiFormData.password}
                                onChange={handleApiFormChange("password")}
                                placeholder="Enter your password"
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                                required
                              />
                            </div>
                          </>
                        )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleApiMethodSelect(null)}
                          className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={connectionLoading}
                          className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {connectionLoading ? "Connecting..." : "Connect"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
          </div>
        </div>
      )}

      {isErpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-8"
          >
            <button
              onClick={closeErpModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>

              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  NetZero-ERP Integration
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Our comprehensive Enterprise Resource Planning system is
                  currently under development and will be available in an
                  upcoming release. This integrated solution will enable
                  seamless data synchronization, advanced analytics, and
                  enhanced carbon footprint tracking capabilities.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Stay tuned for updates and early access notifications.
                </p>
              </div>

              <button
                onClick={closeErpModal}
                className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CO2 Emissions Analysis Modal */}
      {isAnalysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-4xl rounded-2xl bg-[#111] border border-white/10 p-8 max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={closeAnalysisModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  CO2 Emissions Analysis
                </h3>
                <p className="text-gray-400 text-sm">
                  Carbon footprint analysis based on {salesData?.count || 0}{" "}
                  sales orders from Odoo
                </p>
              </div>

              {co2Data.length > 0 ? (
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={co2Data}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis
                        dataKey="month"
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis
                        stroke="#9ca3af"
                        style={{ fontSize: "12px" }}
                        label={{
                          value: "CO2 Emissions (kg CO2e)",
                          angle: -90,
                          position: "insideLeft",
                          style: { fill: "#9ca3af" },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        formatter={(value) => [`${value} kg CO2e`, "Emissions"]}
                      />
                      <Legend wrapperStyle={{ color: "#9ca3af" }} />
                      <Line
                        type="monotone"
                        dataKey="emission"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                        activeDot={{ r: 7 }}
                        name="CO2 Emissions"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  No data available for analysis
                </div>
              )}

              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">
                      Total Orders
                    </div>
                    <div className="text-white font-semibold text-lg">
                      {salesData?.count || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">
                      Total CO2 Emissions
                    </div>
                    <div className="text-white font-semibold text-lg">
                      {co2Data
                        .reduce((sum, item) => sum + item.emission, 0)
                        .toFixed(2)}{" "}
                      kg CO2e
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">
                      Average per Order
                    </div>
                    <div className="text-white font-semibold text-lg">
                      {salesData?.count > 0
                        ? (
                            co2Data.reduce(
                              (sum, item) => sum + item.emission,
                              0
                            ) / salesData.count
                          ).toFixed(2)
                        : "0.00"}{" "}
                      kg CO2e
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={closeAnalysisModal}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
