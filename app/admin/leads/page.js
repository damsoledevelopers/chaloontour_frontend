'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '../../../components/Layout/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { api } from '../../../lib/api'
import { Search, Phone, Mail, MapPin, Calendar, User, Plus, Edit, Eye, Trash2, Upload, X, Users, UserCheck, TrendingUp, CheckCircle, UserX, AlertCircle, ArrowUp, FileText, Printer, RefreshCw, ChevronUp, ChevronDown, MoreHorizontal, Clock, Package, BarChart3, Bell, Target, Zap, Shield, Activity, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import EntryPermissionModal from '../../../components/Permissions/EntryPermissionModal'
import AddLeadModal from '../../../components/Leads/AddLeadModal'
import LeadDetailsModal from '../../../components/Leads/LeadDetailsModal'
import EditLeadModal from '../../../components/Leads/EditLeadModal'
import { checkEntryPermission } from '../../../lib/permissions'

// Helper to get token from localStorage (persists across sessions)
const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

/**
 * Helper: resolve entry-level permission with safe fallback to module-level permission.
 * If an entry has an explicit boolean for the action, honor it.
 * If entry-level permission is missing/undefined, fall back to module-level permission.
 */
function resolveEntryPermission(req, entry, moduleName, action) {
  // entry may have a permissions object like { delete: true/false }
  const entryPerms = entry?.permissions
  if (entryPerms && Object.prototype.hasOwnProperty.call(entryPerms, action)) {
    // explicit boolean set on the entry — honor it
    return Boolean(entryPerms[action])
  }

  // No explicit entry-level value — fallback to module-level user permission
  // Adjust this based on how module permissions are stored on the user object in your app.
  // Common shapes:
  // - req.user.permissions = { leads: { delete: true } }
  // - req.user.roles / checkPermission(...) middleware functions
  const modulePerm = req.user?.permissions?.[moduleName]?.[action]
  if (typeof modulePerm === 'boolean') return modulePerm

  // Final safe default: deny by default OR allow by default depending on product policy.
  // Here we choose to fallback to allowing when module-level permission is granted (conservative for legacy records).
  return true
}

export default function AdminLeadsPage() {
  const { user, loading: authLoading, checkPermission } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Open modal from query (e.g. /admin/leads?add=1, ?view=id, ?edit=id)
  useEffect(() => {
    if (authLoading || !user) return
    const add = searchParams.get('add')
    const viewId = searchParams.get('view')
    const editId = searchParams.get('edit')
    if (add === '1') {
      setShowAddModal(true)
      router.replace('/admin/leads', { scroll: false })
    } else if (viewId) {
      setEditLeadId(null)
      setShowEditModal(false)
      api.get(`/leads/${viewId}`).then((r) => {
        setViewLead(r.data.lead)
        setShowViewModal(true)
      }).catch(() => toast.error('Lead not found'))
      router.replace('/admin/leads', { scroll: false })
    } else if (editId) {
      setViewLead(null)
      setShowViewModal(false)
      setEditLeadId(editId)
      setShowEditModal(true)
      router.replace('/admin/leads', { scroll: false })
    }
  }, [searchParams, authLoading, user])

  // Role-based access control
  useEffect(() => {
    if (!authLoading && user) {
      if (!checkPermission('leads', 'view')) {
        toast.error('You do not have permission to view Leads')
        router.push('/admin/dashboard')
      }
    }
  }, [user, authLoading, router, checkPermission])

  // Role-based feature visibility
  const isSuperAdmin = user?.role === 'super_admin'
  const isAgencyAdmin = user?.role === 'agency_admin'
  const isAgent = user?.role === 'agent'
  const isStaff = user?.role === 'staff'

  // Dynamic permissions from Super Admin
  const canViewLeads = checkPermission('leads', 'view')
  const canCreateLead = checkPermission('leads', 'create')
  const canEditLead = checkPermission('leads', 'edit')
  const canDeleteLead = checkPermission('leads', 'delete')

  const canUploadLeads = canCreateLead
  const canBulkActions = canEditLead || canDeleteLead

  const [leads, setLeads] = useState([])
  const [allLeads, setAllLeads] = useState([]) // For Kanban view
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'kanban'
  const [filters, setFilters] = useState({
    owner: '',
    source: '',
    status: '',
    search: '',
    startDate: '',
    endDate: '',
    agency: '',
    property: '',
    reportingManager: '',
    team: '',
    priority: ''
  })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedData, setUploadedData] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState([])
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [sortColumn, setSortColumn] = useState('companyName')
  const [sortDirection, setSortDirection] = useState('asc')
  const [owners, setOwners] = useState([])
  const [allAgents, setAllAgents] = useState([]) // Store all agents for per-lead filtering
  const [sources, setSources] = useState([])
  const [agencies, setAgencies] = useState([])
  const [properties, setProperties] = useState([])
  const isUploadingRef = useRef(false)
  const [selectedLeads, setSelectedLeads] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkAgent, setBulkAgent] = useState('')
  const [bulkAgency, setBulkAgency] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [dashboardMetrics, setDashboardMetrics] = useState(null)
  const [missedFollowUps, setMissedFollowUps] = useState(0)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [reportingManagers, setReportingManagers] = useState([])
  const [teams, setTeams] = useState([])
  const [rescoring, setRescoring] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null)
  const [permissionModalEntry, setPermissionModalEntry] = useState(null)
  const [draggedLead, setDraggedLead] = useState(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState(null)
  const [kanbanLeadsCapped, setKanbanLeadsCapped] = useState(false)
  const [filterChangeTimer, setFilterChangeTimer] = useState(null)
  const metadataFetchedRef = useRef(false)
  const lastFilterStateRef = useRef(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewLead, setViewLead] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLeadId, setEditLeadId] = useState(null)

  // Separate effect for initial data fetch (runs once on auth)
  useEffect(() => {
    if (isUploadingRef.current) {
      return
    }
    const token = getToken()

    if (!authLoading && user) {
      if (!token) {
        console.warn('User is logged in but no token session found. Please log in again.')
        toast.error('Session expired. Please log in again.')
      } else {
        fetchLeads()
        fetchDashboardMetrics()
        fetchMissedFollowUps()

        // Batch metadata fetches using Promise.all (fetch once)
        if (!metadataFetchedRef.current) {
          Promise.all([
            owners.length === 0 ? fetchOwners() : Promise.resolve(),
            agencies.length === 0 ? fetchAgencies() : Promise.resolve(),
            properties.length === 0 ? fetchProperties() : Promise.resolve(),
            fetchReportingManagers(),
            fetchTeams()
          ]).then(() => {
            metadataFetchedRef.current = true
          }).catch(err => {
            console.error('Error fetching metadata:', err)
            metadataFetchedRef.current = true
          })
        }
      }
    } else if (!authLoading && !user) {
      setLoading(false)
    }
  }, [user, authLoading])

  // Separate effect for filter/pagination changes (debounced to prevent excessive fetching)
  useEffect(() => {
    if (isUploadingRef.current || !user || authLoading) {
      return
    }

    // Create filter state string to detect actual changes
    const filterState = JSON.stringify({
      viewMode,
      startDate: filters.startDate,
      endDate: filters.endDate,
      owner: filters.owner,
      source: filters.source,
      status: filters.status,
      agency: filters.agency,
      property: filters.property,
      reportingManager: filters.reportingManager,
      team: filters.team,
      priority: filters.priority,
      search: filters.search,
      page: pagination.page,
      limit: pagination.limit
    })

    if (lastFilterStateRef.current === filterState) {
      return
    }

    lastFilterStateRef.current = filterState

    if (filterChangeTimer) {
      clearTimeout(filterChangeTimer)
    }

    // Debounce: wait 300ms before fetching to batch rapid filter changes
    const timer = setTimeout(() => {
      fetchLeads()
      fetchDashboardMetrics()
    }, 300)

    setFilterChangeTimer(timer)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [filters, pagination.page, pagination.limit, user, authLoading, viewMode])


  // Refetch owners only when agency filter explicitly changes
  useEffect(() => {
    if (!authLoading && user && filters.agency) {
      fetchOwners()
    }
  }, [filters.agency, user, authLoading])

  // Cleanup search debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }
    }
  }, [searchDebounceTimer])


  useEffect(() => {
    setShowBulkActions(selectedLeads.length > 0)
  }, [selectedLeads])

  // Show loading or redirect if not authorized
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return null
  }

  const fetchLeads = async (overrideViewMode) => {
    try {
      setLoading(true)
      const effectiveViewMode = overrideViewMode !== undefined ? overrideViewMode : viewMode
      // Exclude date filters from the initial spread to avoid duplication
      const { startDate, endDate, ...otherFilters } = filters
      
      // For Kanban view, fetch leads with optimized pagination
      if (effectiveViewMode === 'kanban') {
        try {
          // Optimize: Limit total leads fetched for Kanban to prevent UI blocking
          // Reduced from 2000 to 500 total leads for better performance
          const maxLimit = 250 // Smaller page size for better pagination
          const maxTotalLeads = 500 // Max 500 leads total (2 pages max) to prevent blocking
          const kanbanParams = new URLSearchParams({ limit: String(maxLimit), page: '1' })
          
          // Use the destructured date variables
          if (startDate) {
            kanbanParams.append('startDate', startDate)
          }
          if (endDate) {
            kanbanParams.append('endDate', endDate)
          }
          // Add all other filters
          Object.entries(otherFilters).forEach(([key, value]) => {
            if (value && value !== '') {
              // Trim search values to avoid issues with whitespace
              const trimmedValue = key === 'search' ? String(value).trim() : value
              if (trimmedValue) {
                kanbanParams.append(key, trimmedValue)
              }
            }
          })
          
          // Fetch first batch immediately
          const allResponse = await api.get(`/leads?${kanbanParams}`)
          let fetchedAllLeads = allResponse.data.leads || []
          const totalLeads = allResponse.data.pagination?.total || fetchedAllLeads.length
          
          console.log('Kanban fetch - Initial batch:', fetchedAllLeads.length, 'Total from API:', totalLeads)
          
          // Calculate how many pages we need (capped at maxTotalLeads)
          const leadsToFetch = Math.min(totalLeads, maxTotalLeads)
          const totalPages = Math.ceil(leadsToFetch / maxLimit)
          
          // Only fetch second page to show we have more data, don't load all upfront
          // This prevents UI blocking and allows lazy-loading on scroll
          if (totalPages > 1 && fetchedAllLeads.length < leadsToFetch) {
            const secondPageParams = new URLSearchParams(kanbanParams)
            secondPageParams.set('page', '2')
            
            try {
              const response = await api.get(`/leads?${secondPageParams}`)
              if (response.data.leads) {
                fetchedAllLeads = [...fetchedAllLeads, ...response.data.leads]
              }
            } catch (error) {
              console.warn('Could not fetch second page for kanban:', error.message)
            }
          }
          
          console.log('Kanban fetch - After lazy-load optimization:', fetchedAllLeads.length)
          
          // Trim to maxTotalLeads if we fetched more
          const wasCapped = fetchedAllLeads.length > maxTotalLeads || totalLeads > maxTotalLeads
          if (fetchedAllLeads.length > maxTotalLeads) {
            fetchedAllLeads = fetchedAllLeads.slice(0, maxTotalLeads)
          }
          
          // Filter by permissions (do this after fetching to avoid multiple API calls)
          const filteredLeads = fetchedAllLeads.filter(lead => {
            const hasPermission = checkEntryPermission(lead, user, 'view', canViewLeads)
            if (!hasPermission) {
              console.log('Lead filtered out by permissions:', lead._id, lead.contact?.firstName, lead.contact?.lastName)
            }
            return hasPermission
          })
          
          console.log('Kanban fetch - After permission filter:', filteredLeads.length, 'out of', fetchedAllLeads.length)
          
          // Update state - ensure we set the state even if filtered leads is empty (for debugging)
          setAllLeads(filteredLeads)
          setKanbanLeadsCapped(wasCapped)
          setLeads(filteredLeads.slice(0, pagination.limit))
          setPagination({
            page: 1,
            limit: pagination.limit,
            total: filteredLeads.length,
            pages: Math.ceil(filteredLeads.length / pagination.limit)
          })
          
          // Log if we have fetched leads but they were all filtered out
          if (fetchedAllLeads.length > 0 && filteredLeads.length === 0) {
            console.warn('⚠️ Kanban: API returned', fetchedAllLeads.length, 'leads but all were filtered out by permissions')
            console.warn('User permissions - canViewLeads:', canViewLeads, 'user:', user?.role, user?._id)
          }
        } catch (error) {
          console.error('Error fetching all leads for Kanban:', error)
          const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to load leads for Kanban view'
          toast.error(errorMessage)
          setAllLeads([])
          setLeads([])
          setKanbanLeadsCapped(false)
        } finally {
          // Ensure loading is set to false after Kanban fetch completes
          setLoading(false)
        }
      } else {
        // For List view, fetch paginated leads
        const filteredFilters = Object.entries(otherFilters)
          .filter(([key, value]) => {
            // Filter out empty values, and trim search values
            if (!value || value === '') return false
            if (key === 'search') {
              return String(value).trim() !== ''
            }
            return true
          })
          .map(([key, value]) => {
            // Trim search values
            if (key === 'search') {
              return [key, String(value).trim()]
            }
            return [key, value]
          })
        
        const params = new URLSearchParams({
          page: pagination.page,
          limit: pagination.limit,
          ...Object.fromEntries(filteredFilters)
        })

        // Add date filters separately if provided
        if (startDate) {
          params.append('startDate', startDate)
        }
        if (endDate) {
          params.append('endDate', endDate)
        }

        const response = await api.get(`/leads?${params}`)
        const fetchedLeads = response.data.leads || []
        setLeads(fetchedLeads.filter(lead => checkEntryPermission(lead, user, 'view', canViewLeads)))
        setPagination(response.data.pagination || { page: 1, limit: 10, total: 0, pages: 0 })
        
        // Clear allLeads when in list view
        setAllLeads([])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load leads'

      if (error.response?.status === 401) {
        toast.error('Authentication required. Please log in again.')
      } else {
        toast.error(errorMessage)
      }

      setLeads([])
      if (viewMode === 'kanban') {
        setAllLeads([])
        setKanbanLeadsCapped(false)
      }
      setPagination({ page: 1, limit: 10, total: 0, pages: 0 })
    } finally {
      setLoading(false)
    }
  }

  const fetchOwners = async () => {
    try {
      const agents = user?.role === 'agent' ? [user] : []
      setOwners(agents)
      setAllAgents(agents)

      // Extract unique sources from leads (role-based)
      const responseLeads = await api.get('/leads?limit=500')
      const allLeadsData = responseLeads.data.leads || []
      const uniqueSources = [...new Set(allLeadsData.map(lead => lead.source).filter(Boolean))]
      setSources(uniqueSources)
    } catch (error) {
      console.error('Error fetching owners:', error)
    }
  }

  const fetchAgencies = async () => {
    try {
      // Role-based filtering for agencies
      if (user?.role === 'super_admin') {
        // Super admin can see all agencies
        const response = await api.get('/agencies')
        setAgencies(response.data.agencies || [])
      } else if (user?.role === 'agency_admin') {
        // Agency admin can only see their own agency
        if (user.agency) {
          const response = await api.get(`/agencies/${user.agency}`)
          setAgencies(response.data.agency ? [response.data.agency] : [])
        }
      } else if (user?.role === 'agent') {
        // Agent can only see their agency
        if (user.agency) {
          const response = await api.get(`/agencies/${user.agency}`)
          setAgencies(response.data.agency ? [response.data.agency] : [])
        }
      } else {
        const response = await api.get('/agencies')
        setAgencies(response.data.agencies || [])
      }
    } catch (error) {
      console.error('Error fetching agencies:', error)
      setAgencies([])
    }
  }

  const fetchProperties = async () => {
    setProperties([])
  }

  const fetchDashboardMetrics = async () => {
    try {
      setLoadingMetrics(true)
      const params = new URLSearchParams()

      // Add active filters to the metrics request
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params.append(key, value)
        }
      })

      const response = await api.get(`/leads/analytics/dashboard-metrics?${params}`)
      const metrics = response.data.metrics || null
      setDashboardMetrics(metrics)

      // Update missed follow-ups from the backend metrics
      if (metrics && typeof metrics.missedFollowUps === 'number') {
        setMissedFollowUps(metrics.missedFollowUps)
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const fetchMissedFollowUps = async () => {
    // This is now predominantly handled by fetchDashboardMetrics
    // but kept as a stub or fallback if needed for specific logic
    if (!dashboardMetrics) {
      try {
        const now = new Date()
        const response = await api.get('/leads?limit=500')
        const allLeadsData = response.data.leads || []
        const missed = allLeadsData.filter(lead => {
          if (!lead.followUpDate) return false
          const followUpDate = new Date(lead.followUpDate)
          const isPastDue = followUpDate < now
          const activeStatuses = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_completed', 'negotiation']
          return isPastDue && activeStatuses.includes(lead.status)
        }).length
        setMissedFollowUps(missed)
      } catch (error) {
        console.error('Error fetching missed follow-ups fallback:', error)
      }
    }
  }

  const fetchReportingManagers = async () => {
    setReportingManagers([])
  }

  const fetchTeams = async () => {
    setTeams([])
  }

  const clearAllFilters = () => {
    setFilters({
      owner: '',
      source: '',
      status: '',
      search: '',
      startDate: '',
      endDate: '',
      agency: '',
      property: '',
      reportingManager: '',
      team: '',
      priority: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
    toast.success('All filters cleared')
  }

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== '' && value !== null)
  }

  const handleReScoreLead = async (leadId) => {
    try {
      setRescoring(leadId)
      await api.post(`/leads/${leadId}/re-score`)
      toast.success('Lead re-scored successfully')
      fetchLeads()
    } catch (error) {
      console.error('Error re-scoring lead:', error)
      toast.error('Failed to re-score lead')
    } finally {
      setRescoring(null)
    }
  }

  const getLeadId = (lead) => {
    if (!lead) return ''
    if (typeof lead._id === 'string') return lead._id
    if (lead._id?.toString) return lead._id.toString()
    if (lead._id?.$oid) return lead._id.$oid
    return String(lead._id || lead.id || '')
  }

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStatus })
      toast.success('Lead status updated')
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error updating lead:', error)
      toast.error('Failed to update lead status')
    }
  }

  const handlePriorityChange = async (leadId, newPriority) => {
    try {
      await api.put(`/leads/${leadId}`, { priority: newPriority })
      toast.success('Lead priority updated')
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error updating lead priority:', error)
      toast.error('Failed to update lead priority')
    }
  }

  const handleQuickAssign = async (leadId, agentId) => {
    // Check if the value actually changed to avoid unnecessary updates
    const currentLead = leads.find(lead => String(getLeadId(lead)) === String(leadId))
    const currentAgentId = currentLead?.assignedAgent?._id ? String(currentLead.assignedAgent._id) : (currentLead?.assignedAgent ? String(currentLead.assignedAgent) : null)
    const newAgentId = agentId ? String(agentId) : null

    if (currentAgentId === newAgentId) {
      // Value hasn't changed, skip update
      return
    }

    // Store previous state references for rollback
    let previousLeadsState = null
    let previousAllLeadsState = null

    // Optimistic update - update UI immediately
    const assignedAgent = agentId ? owners.find(o => String(o._id) === String(agentId)) : null
    setLeads(prevLeads => {
      previousLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return {
            ...lead,
            assignedAgent: assignedAgent ? {
              _id: assignedAgent._id,
              firstName: assignedAgent.firstName,
              lastName: assignedAgent.lastName
            } : null
          }
        }
        return lead
      })
    })

    // Also update allLeads for Kanban view
    setAllLeads(prevLeads => {
      previousAllLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return {
            ...lead,
            assignedAgent: assignedAgent ? {
              _id: assignedAgent._id,
              firstName: assignedAgent.firstName,
              lastName: assignedAgent.lastName
            } : null
          }
        }
        return lead
      })
    })

    try {
      const response = await api.put(`/leads/${leadId}/assign`, { assignedAgent: agentId })

      // Update with server response only if it's different
      if (response.data?.lead) {
        const serverAgent = response.data.lead.assignedAgent
        setLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              const currentAgent = lead.assignedAgent?._id ? String(lead.assignedAgent._id) : (lead.assignedAgent ? String(lead.assignedAgent) : null)
              const serverAgentId = serverAgent?._id ? String(serverAgent._id) : (serverAgent ? String(serverAgent) : null)
              if (currentAgent !== serverAgentId) {
                return { ...lead, assignedAgent: serverAgent }
              }
            }
            return lead
          })
        )
        setAllLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              const currentAgent = lead.assignedAgent?._id ? String(lead.assignedAgent._id) : (lead.assignedAgent ? String(lead.assignedAgent) : null)
              const serverAgentId = serverAgent?._id ? String(serverAgent._id) : (serverAgent ? String(serverAgent) : null)
              if (currentAgent !== serverAgentId) {
                return { ...lead, assignedAgent: serverAgent }
              }
            }
            return lead
          })
        )
      }

      toast.success('Lead assigned successfully')
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      // Rollback on error
      if (previousLeadsState) {
        setLeads(previousLeadsState)
      }
      if (previousAllLeadsState) {
        setAllLeads(previousAllLeadsState)
      }
      console.error('Error assigning lead:', error)
      toast.error('Failed to assign lead')
    }
  }

  const handleQuickAgencyChange = async (leadId, agencyId) => {
    // Check if the value actually changed to avoid unnecessary updates
    const currentLead = leads.find(lead => String(getLeadId(lead)) === String(leadId))
    const currentAgencyId = currentLead?.agency?._id ? String(currentLead.agency._id) : (currentLead?.agency ? String(currentLead.agency) : null)
    const newAgencyId = agencyId ? String(agencyId) : null

    if (currentAgencyId === newAgencyId) {
      // Value hasn't changed, skip update
      return
    }

    // Store previous state references for rollback
    let previousLeadsState = null
    let previousAllLeadsState = null

    // Optimistic update - update UI immediately
    const selectedAgency = agencyId ? agencies.find(a => String(a._id) === String(agencyId)) : null
    setLeads(prevLeads => {
      previousLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return {
            ...lead,
            agency: selectedAgency ? { _id: selectedAgency._id, name: selectedAgency.name } : null
          }
        }
        return lead
      })
    })

    // Also update allLeads for Kanban view
    setAllLeads(prevLeads => {
      previousAllLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return {
            ...lead,
            agency: selectedAgency ? { _id: selectedAgency._id, name: selectedAgency.name } : null
          }
        }
        return lead
      })
    })

    try {
      const response = await api.put(`/leads/${leadId}`, { agency: agencyId || null })

      // Update with server response only if it's different
      if (response.data?.lead) {
        const serverAgency = response.data.lead.agency
        setLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              const currentAgency = lead.agency?._id ? String(lead.agency._id) : (lead.agency ? String(lead.agency) : null)
              const serverAgencyId = serverAgency?._id ? String(serverAgency._id) : (serverAgency ? String(serverAgency) : null)
              if (currentAgency !== serverAgencyId) {
                return { ...lead, agency: serverAgency }
              }
            }
            return lead
          })
        )
        setAllLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              const currentAgency = lead.agency?._id ? String(lead.agency._id) : (lead.agency ? String(lead.agency) : null)
              const serverAgencyId = serverAgency?._id ? String(serverAgency._id) : (serverAgency ? String(serverAgency) : null)
              if (currentAgency !== serverAgencyId) {
                return { ...lead, agency: serverAgency }
              }
            }
            return lead
          })
        )
      }

      toast.success('Lead agency updated successfully')
      fetchDashboardMetrics()
    } catch (error) {
      // Rollback on error
      if (previousLeadsState) {
        setLeads(previousLeadsState)
      }
      if (previousAllLeadsState) {
        setAllLeads(previousAllLeadsState)
      }
      console.error('Error updating lead agency:', error)
      toast.error('Failed to update lead agency')
    }
  }

  const handleQuickPriorityChange = async (leadId, priority) => {
    // Send empty string as null for proper backend handling
    const priorityValue = priority === '' ? null : priority

    // Check if the value actually changed to avoid unnecessary updates
    const currentLead = leads.find(lead => String(getLeadId(lead)) === String(leadId))
    const currentPriority = currentLead?.priority || null
    const normalizedCurrentPriority = currentPriority ? String(currentPriority).toLowerCase() : null
    const normalizedNewPriority = priorityValue ? String(priorityValue).toLowerCase() : null

    if (normalizedCurrentPriority === normalizedNewPriority) {
      // Value hasn't changed, skip update
      return
    }

    // Store previous state references for rollback BEFORE functional update
    const previousLeadsState = [...leads]
    const previousAllLeadsState = [...allLeads]

    // Optimistic update - update UI immediately using functional updates
    setLeads(prevLeads => {
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, priority: priorityValue }
        }
        return lead
      })
    })

    // Also update allLeads for Kanban view
    setAllLeads(prevLeads => {
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, priority: priorityValue }
        }
        return lead
      })
    })

    console.log(`🚀 Initiating priority update for lead ${leadId} to ${priorityValue}`)

    try {
      const response = await api.put(`/leads/${leadId}`, { priority: priorityValue })
      console.log('✅ Server response received:', response.data)

      // Always update with server response to ensure consistency
      if (response.data?.lead) {
        const serverPriority = response.data.lead.priority
        console.log(`✨ Server confirmed priority: ${serverPriority}`)
        toast.success(`Priority updated to ${serverPriority === 'not_interested' ? 'Not Interested' : serverPriority.charAt(0).toUpperCase() + serverPriority.slice(1)}`)

        setLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              console.log('Updating lead priority from', lead.priority, 'to', serverPriority)
              return { ...lead, priority: serverPriority }
            }
            return lead
          })
        )
        setAllLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              return { ...lead, priority: serverPriority }
            }
            return lead
          })
        )
      } else {
        // If no lead in response, ensure optimistic update is maintained
        console.log('No lead in server response, keeping optimistic update')
      }

      toast.success('Lead priority updated successfully')
    } catch (error) {
      // Rollback on error - restore previous state
      if (previousLeadsState) {
        setLeads(previousLeadsState)
      }
      if (previousAllLeadsState) {
        setAllLeads(previousAllLeadsState)
      }
      console.error('Error updating lead priority:', error)
      toast.error('Failed to update lead priority')
    }
  }

  const handleQuickStatusChange = async (leadId, status) => {
    const statusValue = status || null

    // Check if the value actually changed to avoid unnecessary updates
    const currentLead = leads.find(lead => String(getLeadId(lead)) === String(leadId))
    const currentStatus = currentLead?.status || null
    const normalizedCurrentStatus = currentStatus ? String(currentStatus).toLowerCase() : null
    const normalizedNewStatus = statusValue ? String(statusValue).toLowerCase() : null

    if (normalizedCurrentStatus === normalizedNewStatus) {
      // Value hasn't changed, skip update
      return
    }

    // Store previous state references for rollback
    let previousLeadsState = null
    let previousAllLeadsState = null

    // Optimistic update - update UI immediately
    setLeads(prevLeads => {
      previousLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, status: statusValue }
        }
        return lead
      })
    })

    // Also update allLeads for Kanban view
    setAllLeads(prevLeads => {
      previousAllLeadsState = prevLeads
      return prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, status: statusValue }
        }
        return lead
      })
    })

    try {
      const response = await api.put(`/leads/${leadId}`, { status: statusValue })

      // Update with server response only if it's different
      if (response.data?.lead) {
        const serverStatus = response.data.lead.status
        const normalizedServerStatus = serverStatus ? String(serverStatus).toLowerCase() : null

        // Only update if server value is different from optimistic update
        if (normalizedServerStatus !== normalizedNewStatus) {
          setLeads(prevLeads =>
            prevLeads.map(lead => {
              const id = getLeadId(lead)
              if (String(id) === String(leadId)) {
                return { ...lead, status: serverStatus }
              }
              return lead
            })
          )
          setAllLeads(prevLeads =>
            prevLeads.map(lead => {
              const id = getLeadId(lead)
              if (String(id) === String(leadId)) {
                return { ...lead, status: serverStatus }
              }
              return lead
            })
          )
        }
      }

      toast.success('Lead status updated successfully')
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      // Rollback on error
      if (previousLeadsState) {
        setLeads(previousLeadsState)
      }
      if (previousAllLeadsState) {
        setAllLeads(previousAllLeadsState)
      }
      console.error('Error updating lead status:', error)
      toast.error('Failed to update lead status')
    }
  }

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target)
  }

  const handleDragOver = (e, columnId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggedOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverColumn(null)

    if (!draggedLead) return

    const leadId = getLeadId(draggedLead)
    const currentStatus = draggedLead.status || 'new'
    const normalizedCurrentStatus = currentStatus ? String(currentStatus).toLowerCase() : 'new'
    const normalizedTargetStatus = targetStatus ? String(targetStatus).toLowerCase() : 'new'

    // Don't update if dropped in the same column
    if (normalizedCurrentStatus === normalizedTargetStatus) {
      setDraggedLead(null)
      return
    }

    // Store previous state for rollback
    const previousAllLeadsState = [...allLeads]
    const previousLeadsState = [...leads]

    // Optimistically update UI - update the lead's status in place (no duplication)
    setAllLeads(prevLeads =>
      prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, status: targetStatus }
        }
        return lead
      })
    )

    // Also update leads array for list view consistency
    setLeads(prevLeads =>
      prevLeads.map(lead => {
        const id = getLeadId(lead)
        if (String(id) === String(leadId)) {
          return { ...lead, status: targetStatus }
        }
        return lead
      })
    )

    try {
      // Make API call to update status
      const response = await api.put(`/leads/${leadId}`, { status: targetStatus })

      // Update with server response to ensure consistency
      if (response.data?.lead) {
        const updatedLead = response.data.lead
        setAllLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              return { ...lead, ...updatedLead }
            }
            return lead
          })
        )
        setLeads(prevLeads =>
          prevLeads.map(lead => {
            const id = getLeadId(lead)
            if (String(id) === String(leadId)) {
              return { ...lead, ...updatedLead }
            }
            return lead
          })
        )
      }

      toast.success('Lead status updated successfully')
      fetchDashboardMetrics()
      fetchMissedFollowUps()
      setDraggedLead(null)
    } catch (error) {
      // Rollback on error
      setAllLeads(previousAllLeadsState)
      setLeads(previousLeadsState)
      setDraggedLead(null)
      console.error('Error updating lead status:', error)
      toast.error('Failed to update lead status')
    }
  }

  const handleDragEnd = () => {
    setDraggedLead(null)
    setDraggedOverColumn(null)
  }

  const handleDelete = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return
    try {
      await api.delete(`/leads/${leadId}`)
      toast.success('Lead deleted successfully')
      setSelectedLeads(selectedLeads.filter(id => id !== leadId))
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error deleting lead:', error)
      // Surface permission errors clearly
      if (error.response?.status === 403) {
        toast.error('Permission denied: you cannot delete this lead.')
        // Optionally open permission modal for owners/super admins to inspect/set entry permissions:
        // if (user?.role === 'super_admin') setPermissionModalEntry({ _id: leadId })
      } else {
        toast.error('Failed to delete lead')
      }
    }
  }

  const handleSelectLead = (leadId) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const handleSelectAll = () => {
    if (selectedLeads.length === sortedLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(sortedLeads.map(lead => getLeadId(lead)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to delete')
      return
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} lead(s)? This action cannot be undone.`)) return

    try {
      const deletePromises = selectedLeads.map(id => api.delete(`/leads/${id}`))
      await Promise.all(deletePromises)
      toast.success(`${selectedLeads.length} lead(s) deleted successfully`)
      setSelectedLeads([])
      setShowBulkActions(false)
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error bulk deleting leads:', error)
      toast.error('Failed to delete some leads')
    }
  }

  const handleBulkUpdateStatus = async () => {
    if (selectedLeads.length === 0 || !bulkStatus) {
      toast.error('Please select leads and a status')
      return
    }

    try {
      const updatePromises = selectedLeads.map(id => api.put(`/leads/${id}`, { status: bulkStatus }))
      await Promise.all(updatePromises)
      toast.success(`${selectedLeads.length} lead(s) status updated successfully`)
      setSelectedLeads([])
      setShowBulkActions(false)
      setBulkStatus('')
      setShowBulkModal(false)
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error bulk updating status:', error)
      toast.error('Failed to update some leads')
    }
  }

  const handleBulkAssign = async () => {
    if (selectedLeads.length === 0 || !bulkAgent) {
      toast.error('Please select leads and an agent')
      return
    }

    try {
      const assignPromises = selectedLeads.map(id => api.put(`/leads/${id}/assign`, { assignedAgent: bulkAgent }))
      await Promise.all(assignPromises)
      toast.success(`${selectedLeads.length} lead(s) assigned successfully`)
      setSelectedLeads([])
      setShowBulkActions(false)
      setBulkAgent('')
      setShowBulkModal(false)
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error bulk assigning leads:', error)
      toast.error('Failed to assign some leads')
    }
  }

  const handleBulkAssignAgency = async () => {
    if (selectedLeads.length === 0 || !bulkAgency) {
      toast.error('Please select leads and an agency')
      return
    }

    try {
      const assignPromises = selectedLeads.map(id => api.put(`/leads/${id}`, { agency: bulkAgency }))
      await Promise.all(assignPromises)
      toast.success(`${selectedLeads.length} lead(s) agency assigned successfully`)
      setSelectedLeads([])
      setShowBulkActions(false)
      setBulkAgency('')
      setShowBulkModal(false)
      fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error bulk assigning agency:', error)
      toast.error('Failed to assign agency to some leads')
    }
  }


  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      contacted: 'bg-blue-100 text-blue-800 border-blue-200',
      qualified: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      site_visit_scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
      site_visit_completed: 'bg-violet-100 text-violet-800 border-violet-200',
      negotiation: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      booked: 'bg-green-100 text-green-800 border-green-200',
      closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lost: 'bg-red-100 text-red-800 border-red-200',
      junk: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusBorderColor = (status) => {
    const colors = {
      new: 'border-yellow-400',
      contacted: 'border-blue-400',
      qualified: 'border-cyan-400',
      site_visit_scheduled: 'border-purple-400',
      site_visit_completed: 'border-violet-400',
      negotiation: 'border-indigo-400',
      booked: 'border-green-400',
      closed: 'border-emerald-400',
      lost: 'border-red-400',
      junk: 'border-gray-400'
    }
    return colors[status] || 'border-gray-400'
  }

  const getPriorityColor = (priority) => {
    const colors = {
      Hot: 'bg-red-100 text-red-800 border-red-200',
      Warm: 'bg-orange-100 text-orange-800 border-orange-200',
      Cold: 'bg-blue-100 text-blue-800 border-blue-200',
      Not_interested: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    // Case-insensitive lookup for safety
    if (!priority) return colors.Warm;
    const p = String(priority).toLowerCase();
    const key = Object.keys(colors).find(k => k.toLowerCase() === p);
    return colors[key] || colors.Warm;
  }

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedLeads = [...leads].sort((a, b) => {
    let aValue, bValue

    switch (sortColumn) {
      case 'contactName':
        aValue = `${a.contact?.firstName || ''} ${a.contact?.lastName || ''}`.trim()
        bValue = `${b.contact?.firstName || ''} ${b.contact?.lastName || ''}`.trim()
        break
      case 'email':
        aValue = a.contact?.email || ''
        bValue = b.contact?.email || ''
        break
      case 'phone':
        aValue = a.contact?.phone || ''
        bValue = b.contact?.phone || ''
        break
      case 'source':
        aValue = a.source || ''
        bValue = b.source || ''
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      case 'createdDate':
        aValue = new Date(a.createdAt)
        bValue = new Date(b.createdAt)
        break
      case 'updatedAt':
        aValue = new Date(a.updatedAt || a.createdAt)
        bValue = new Date(b.updatedAt || b.createdAt)
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const handleExportExcel = () => {
    try {
      const getSourceLabel = (source) => {
        const labels = {
          website: 'Website',
          phone: 'Phone',
          email: 'Email',
          walk_in: 'Walk In',
          referral: 'Referral',
          social_media: 'Social Media',
          other: 'Other'
        }
        return labels[source] || source || 'Other'
      }

      const getStatusLabel = (status) => {
        if (!status) return 'New Lead'
        const statusLabels = {
          new: 'New Lead',
          contacted: 'Contacted',
          qualified: 'Qualified',
          site_visit_scheduled: 'Site Visit Scheduled',
          site_visit_completed: 'Site Visit Completed',
          negotiation: 'Negotiation',
          booked: 'Booked',
          lost: 'Lost',
          closed: 'Closed',
          junk: 'Junk / Invalid'
        }
        return statusLabels[status?.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
      }

      const data = sortedLeads.map(lead => ({
        'Lead ID': lead.leadId || `LEAD-${String(lead._id).slice(-6)}`,
        'Contact Name': `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || 'N/A',
        'Email': lead.contact?.email || '-',
        'Phone': lead.contact?.phone || '-',
        'Source': getSourceLabel(lead.source),
        'Assigned Agent': lead.assignedAgent ? `${lead.assignedAgent.firstName} ${lead.assignedAgent.lastName}` : 'Unassigned',
        'Priority': lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Warm',
        'Status': getStatusLabel(lead.status),
        'Created Date': new Date(lead.createdAt).toLocaleDateString()
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Leads')
      XLSX.writeFile(wb, `leads_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel file exported successfully')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Failed to export to Excel')
    }
  }

  const handlePrint = () => {
    if (viewMode !== 'list') {
      setViewMode('list')
      setPagination(prev => ({ ...prev, page: 1 }))
      fetchLeads('list')
      setTimeout(() => window.print(), 600)
    } else {
      window.print()
    }
  }

  // Group leads by status for Kanban view
  const kanbanColumns = [
    { id: 'new', title: 'New', colorClass: 'bg-yellow-400' },
    { id: 'contacted', title: 'Contacted', colorClass: 'bg-orange-400' },
    { id: 'qualified', title: 'Qualified', colorClass: 'bg-blue-400' },
    { id: 'site_visit_scheduled', title: 'Site Visit Scheduled', colorClass: 'bg-cyan-400' },
    { id: 'site_visit_completed', title: 'Site Visit Completed', colorClass: 'bg-teal-400' },
    { id: 'negotiation', title: 'Negotiation', colorClass: 'bg-indigo-400' },
    { id: 'booked', title: 'Booked', colorClass: 'bg-green-400' },
    { id: 'closed', title: 'Closed', colorClass: 'bg-emerald-600' },
    { id: 'lost', title: 'Lost', colorClass: 'bg-red-400' },
    { id: 'junk', title: 'Junk', colorClass: 'bg-gray-400' }
  ]

  const getLeadsByStatus = (status) => {
    if (!allLeads || allLeads.length === 0) return []
    return allLeads.filter(lead => {
      if (!lead.status) {
        return status === 'new'
      }
      const leadStatus = String(lead.status).toLowerCase().replace(/\s|_/g, '')
      const colStatus = String(status).toLowerCase().replace(/\s|_/g, '')
      return leadStatus === colStatus;
    })
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop().toLowerCase()
    const validExtensions = ['csv', 'xlsx', 'xls']

    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
      event.target.value = ''
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size is too large. Please upload a file smaller than 10MB')
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        let parsedData = []

        if (fileExtension === 'csv') {
          const csvData = Papa.parse(e.target.result, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
          })
          parsedData = csvData.data
        } else {
          const workbook = XLSX.read(e.target.result, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        }

        if (parsedData.length === 0) {
          toast.error('No data found in the file')
          return
        }

        // Transform data - handle both new format (Contact Name) and old format (First Name, Last Name)
        const transformedData = parsedData.map((row, index) => {
          let firstName = ''
          let lastName = ''

          // Check for "Contact Name" column (new format)
          const contactName = row['Contact Name'] || row['Contact name'] || row['contactName'] || ''
          if (contactName) {
            // Split contact name into first and last name
            const nameParts = contactName.trim().split(/\s+/)
            firstName = nameParts[0] || ''
            lastName = nameParts.slice(1).join(' ') || ''
          } else {
            // Fallback to old format (separate First Name and Last Name columns)
            firstName = row['First Name'] || row['firstName'] || row['First'] || ''
            lastName = row['Last Name'] || row['lastName'] || row['Last'] || ''
          }

          const email = row['Email'] || row['email'] || ''
          const phone = row['Phone'] || row['phone'] || row['Mobile'] || ''

          // Handle source mapping (convert labels back to values)
          let source = (row['Source'] || row['source'] || 'other').toLowerCase()
          const sourceMap = {
            'website': 'website',
            'phone': 'phone',
            'email': 'email',
            'walk in': 'walk_in',
            'walk_in': 'walk_in',
            'referral': 'referral',
            'social media': 'social_media',
            'social_media': 'social_media',
            'other': 'other'
          }
          source = sourceMap[source] || 'other'

          // Handle status mapping (convert labels back to values)
          let status = (row['Status'] || row['status'] || 'new').toLowerCase()
          const statusMap = {
            'new': 'new',
            'new lead': 'new',
            'contacted': 'contacted',
            'qualified': 'qualified',
            'site visit scheduled': 'site_visit_scheduled',
            'site_visit_scheduled': 'site_visit_scheduled',
            'site visit completed': 'site_visit_completed',
            'site_visit_completed': 'site_visit_completed',
            'negotiation': 'negotiation',
            'booked': 'booked',
            'closed': 'closed',
            'lost': 'lost',
            'junk': 'junk',
            'junk / invalid': 'junk',
            'invalid': 'junk'
          }
          status = statusMap[status] || 'new'

          return {
            contact: {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim().replace(/\s+/g, '')
            },
            status: status,
            source: source,
            _rowIndex: index + 2
          }
        }).filter(lead => {
          // Require at least firstName and email OR phone
          return lead.contact.firstName && (lead.contact.email || lead.contact.phone)
        })

        if (transformedData.length === 0) {
          toast.error('No valid leads found in the file')
          return
        }

        setUploadedData(transformedData)
        setShowUploadModal(true)
        toast.success(`Found ${transformedData.length} valid leads in the file`)
        event.target.value = ''
      } catch (error) {
        console.error('Error parsing file:', error)
        toast.error('Error parsing file. Please check the file format.')
        event.target.value = ''
      }
    }

    reader.onerror = () => {
      toast.error('Error reading file. Please try again.')
      event.target.value = ''
    }

    if (fileExtension === 'csv') {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsBinaryString(file)
    }
  }

  const handleBulkUpload = async () => {
    if (uploadedData.length === 0) {
      toast.error('No data to upload')
      return
    }

    setUploading(true)
    setLoading(true)
    isUploadingRef.current = true

    try {
      const response = await api.post('/leads/bulk', { leads: uploadedData })
      const createdCount = response.data.created || 0
      const errors = response.data.errors || []
      const duplicatesCount = response.data.duplicates || 0

      setShowUploadModal(false)
      setUploadedData([])

      if (errors.length > 0) {
        setUploadErrors(errors)
        setShowErrorModal(true)
        toast.error(`Uploaded ${createdCount} leads. ${errors.length} rows had errors.${duplicatesCount ? ` ${duplicatesCount} duplicate(s) skipped.` : ''}`)
      } else if (duplicatesCount > 0) {
        toast.success(`Uploaded ${createdCount} new leads. ${duplicatesCount} duplicate(s) skipped (already exist).`)
        setUploadErrors([])
      } else {
        toast.success(`Successfully uploaded ${createdCount} leads`)
        setUploadErrors([])
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      isUploadingRef.current = false
      await fetchLeads()
      fetchDashboardMetrics()
      fetchMissedFollowUps()
    } catch (error) {
      console.error('Error uploading leads:', error)
      const errorMessage = error.response?.data?.message || 'Failed to upload leads'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 leads-page">
        {/* Dashboard Metrics Widget - hidden when printing */}
        <div className="bg-white rounded-lg shadow-sm p-4 no-print">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lead Metrics</h2>

          </div>
          {loadingMetrics ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : dashboardMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">New Leads Today</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.newLeadsToday || 0}</p>
                    <p className="text-xs text-gray-600 mt-1">This Month: <span className="font-semibold">{dashboardMetrics.newLeadsThisMonth || 0}</span></p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-500 opacity-80" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Leads</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.totalLeads || 0}</p>
                  </div>
                  <Users className="h-10 w-10 text-blue-500 opacity-80" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.conversionRate || 0}%</p>
                    <p className="text-xs text-gray-600 mt-1">Booked/Closed leads</p>
                  </div>
                  <Target className="h-10 w-10 text-purple-500 opacity-80" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Today's Follow-Ups</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.todaysFollowUps?.total || 0}</p>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-gray-600">Pending: <span className="font-semibold text-orange-600">{dashboardMetrics.todaysFollowUps?.pending || 0}</span></p>
                      {dashboardMetrics.todaysFollowUps?.completed > 0 && (
                        <p className="text-xs text-gray-600">Completed: <span className="font-semibold text-green-600">{dashboardMetrics.todaysFollowUps?.completed || 0}</span></p>
                      )}
                      {dashboardMetrics.todaysFollowUps?.total > 0 && (
                        <p className="text-xs text-gray-600">Completion: <span className="font-semibold">{dashboardMetrics.todaysFollowUps?.completionRate || 0}%</span></p>
                      )}
                    </div>
                  </div>
                  <Calendar className="h-10 w-10 text-orange-500 opacity-80" />
                </div>
              </div>
              <div className={`rounded-lg shadow-sm p-4 border-l-4 ${missedFollowUps > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-500' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-500'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Missed Follow-Ups</p>
                    <p className={`text-2xl font-bold mt-1 ${missedFollowUps > 0 ? 'text-red-600' : 'text-gray-900'}`}>{missedFollowUps}</p>
                    {missedFollowUps > 0 && (
                      <button
                        onClick={() => {
                          const now = new Date().toISOString().split('T')[0]
                          setFilters(prev => ({ ...prev, startDate: '', endDate: now }))
                          toast.info('Filtering leads with missed follow-ups')
                        }}
                        className="text-xs text-red-600 hover:text-red-800 mt-1 underline font-medium"
                      >
                        View All →
                      </button>
                    )}
                  </div>
                  <Bell className={`h-10 w-10 opacity-80 ${missedFollowUps > 0 ? 'text-red-500' : 'text-gray-500'}`} />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Unable to load metrics. Please try again.</p>
            </div>
          )}
        </div>

        {/* Header with Tabs - hidden when printing */}
        <div className="bg-white rounded-lg shadow-sm p-4 no-print">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-1 border-b border-gray-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setViewMode('list')
                  setPagination(prev => ({ ...prev, page: 1 }))
                  fetchLeads('list')
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer relative z-10 ${viewMode === 'list'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                  }`}
                style={{ pointerEvents: 'auto' }}
              >
                List View
              </button>
              {/* <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('List tab clicked')
                  setViewMode('list')
                  setPagination(prev => ({ ...prev, page: 1 }))
                  setTimeout(() => {
                    fetchLeads()
                  }, 0)
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer relative z-10 ${
                  viewMode === 'list'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                List
              </button> */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setViewMode('kanban')
                  setPagination(prev => ({ ...prev, page: 1 }))
                  fetchLeads('kanban')
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer relative z-10 ${viewMode === 'kanban'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                  }`}
                style={{ pointerEvents: 'auto' }}
              >
                Kanban
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(isSuperAdmin || isAgencyAdmin) && canCreateLead && (
                <label className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 cursor-pointer text-sm font-medium transition-colors">
                  <Upload className="h-4 w-4" />
                  Import leads
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    onClick={(e) => { e.target.value = '' }}
                  />
                </label>
              )}
              <button type="button" onClick={handleExportExcel} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                <FileText className="h-4 w-4" />
                Excel
              </button>
              <button type="button" onClick={handlePrint} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                <Printer className="h-4 w-4" />
                Print
              </button>
              {canCreateLead && (
                <button type="button" onClick={() => setShowAddModal(true)} className="h-10 inline-flex items-center gap-2 px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium transition-colors">
                  <Plus className="h-4 w-4" />
                  Add lead
                </button>
              )}
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4 py-4 px-5 bg-white border border-gray-100 rounded-xl shadow-card">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={pagination.limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value)
                  setPagination(prev => ({
                    ...prev,
                    limit: newLimit,
                    page: 1,
                    total: prev.total,
                    pages: Math.ceil(prev.total / newLimit)
                  }))
                }}
                className="h-10 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-colors"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <select
                value={filters.source}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, source: e.target.value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="h-10 min-w-[120px] pl-4 pr-9 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%22')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              >
                <option value="">Source</option>
                <option value="website">Website</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="walk_in">Walk In</option>
                <option value="referral">Referral</option>
                <option value="social_media">Social Media</option>
                <option value="other">Other</option>
                {sources.filter(source => !['website', 'phone', 'email', 'walk_in', 'referral', 'social_media', 'other'].includes(source)).map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="h-10 min-w-[140px] pl-4 pr-9 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%22')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              >
                <option value="">Status</option>
                <option value="new">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="site_visit_scheduled">Site Visit Scheduled</option>
                <option value="site_visit_completed">Site Visit Completed</option>
                <option value="negotiation">Negotiation</option>
                <option value="booked">Booked</option>
                <option value="lost">Lost</option>
                <option value="closed">Closed</option>
                <option value="junk">Junk / Invalid</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="h-10 min-w-[120px] pl-4 pr-9 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%22')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              >
                <option value="">Priority</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
                <option value="Not_interested">Not Interested</option>
              </select>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`h-10 inline-flex items-center gap-2 pl-4 pr-4 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors ${filters.startDate || filters.endDate ? 'border-primary-400 text-primary-800 bg-primary-50/50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="max-w-[180px] truncate">
                    {filters.startDate && filters.endDate
                      ? `${new Date(filters.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(filters.endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : filters.startDate
                        ? `${new Date(filters.startDate + 'T00:00:00').toLocaleDateString('en-GB')} – ...`
                        : filters.endDate
                          ? `... – ${new Date(filters.endDate + 'T00:00:00').toLocaleDateString('en-GB')}`
                          : 'Date Range'}
                  </span>
                  {filters.startDate || filters.endDate ? (
                    <X
                      className="h-4 w-4 ml-1 text-gray-500 hover:text-gray-700 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
                        setPagination(prev => ({ ...prev, page: 1 }))
                        fetchLeads()
                      }}
                    />
                  ) : null}
                </button>
                {showDatePicker && (
                  <>
                    <div className="fixed inset-0 z-40 no-print" onClick={() => setShowDatePicker(false)} />
                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 min-w-[320px]">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                          <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => {
                              const newStartDate = e.target.value
                              setFilters(prev => ({ ...prev, startDate: newStartDate }))
                              if (filters.endDate && newStartDate && filters.endDate < newStartDate) setFilters(prev => ({ ...prev, endDate: '' }))
                            }}
                            className="w-full h-10 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                          <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            min={filters.startDate || undefined}
                            className="w-full h-10 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
                            setShowDatePicker(false)
                            setPagination(prev => ({ ...prev, page: 1 }))
                            fetchLeads()
                          }}
                          className="h-9 px-4 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => {
                            setShowDatePicker(false)
                            setPagination(prev => ({ ...prev, page: 1 }))
                            fetchLeads()
                          }}
                          className="h-9 px-4 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or lead ID"
                  value={filters.search || ''}
                  onChange={(e) => {
                    const searchValue = e.target.value
                    setFilters(prev => ({ ...prev, search: searchValue }))
                    setPagination(prev => ({ ...prev, page: 1 }))
                    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
                    const timer = setTimeout(() => {}, 300)
                    setSearchDebounceTimer(timer)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
                      fetchLeads()
                    }
                  }}
                  className="h-10 pl-10 pr-10 w-64 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, search: '' }))
                      setPagination(prev => ({ ...prev, page: 1 }))
                      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
                      fetchLeads()
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters()}
                className={`h-10 inline-flex items-center gap-2 px-4 rounded-xl text-sm font-medium transition-colors ${hasActiveFilters()
                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 focus:ring-2 focus:ring-red-500/20 cursor-pointer'
                  : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
                title={hasActiveFilters() ? 'Clear all filters' : 'No filters to clear'}
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : !sortedLeads || sortedLeads.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-lg">No leads found</p>
              </div>
            ) : (
              <>
                {/* Bulk Actions Bar - hidden when printing */}
                {canBulkActions && showBulkActions && selectedLeads.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 no-print">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-blue-900">
                          {selectedLeads.length} lead(s) selected
                        </span>
                        <button
                          onClick={() => {
                            setShowBulkModal(true)
                            setBulkAction('status')
                          }}
                          className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
                        >
                          Update Status
                        </button>
                        {canDeleteLead && (
                          <button
                            onClick={handleBulkDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            Delete Selected
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLeads([])
                          setShowBulkActions(false)
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}
                <div className="leads-print-area">
                  <h1 className="text-xl font-bold text-gray-900 mb-4 print-only">Leads</h1>
                  {/* Print: one card per lead so all data fits on page */}
                  <div className="hidden print:block space-y-4">
                    {sortedLeads && sortedLeads.map((lead) => {
                      const c = lead.contact || {}
                      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || '–'
                      const statusLabels = { new: 'New Lead', contacted: 'Contacted', qualified: 'Qualified', site_visit_scheduled: 'Site Visit Scheduled', site_visit_completed: 'Site Visit Completed', negotiation: 'Negotiation', booked: 'Booked', lost: 'Lost', closed: 'Closed', junk: 'Junk / Invalid' }
                      const statusVal = statusLabels[(lead.status || 'new').toLowerCase()] || lead.status || '–'
                      const created = lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'
                      return (
                        <div key={getLeadId(lead)} className="border border-gray-200 rounded-lg overflow-hidden break-inside-avoid">
                          <div className="px-4 py-2 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{name}</span>
                            <span className="text-sm font-medium text-primary-700">{statusVal}</span>
                          </div>
                          <div className="p-4 text-sm">
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Mobile Number</span><span className="font-medium text-gray-900">{c.phone || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Email ID</span><span className="font-medium text-gray-900">{c.email || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Lead Source</span><span className="font-medium text-gray-900">{lead.source || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Priority</span><span className="font-medium text-gray-900">{lead.priority || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Lead ID</span><span className="font-medium text-gray-900">{lead.leadId || lead._id || '–'}</span></div>
                            <div className="flex justify-between py-1.5"><span className="text-gray-500">Created At</span><span className="font-medium text-gray-900">{created}</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="print:hidden bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                      <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1600px' }}>
                        <thead className="bg-gradient-to-r from-primary-600 to-primary-700">
                          <tr>
                            {canBulkActions && (
                            <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider w-12">
                              <input
                                type="checkbox"
                                checked={selectedLeads.length === sortedLeads.length && sortedLeads.length > 0}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Lead ID
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Score
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('contactName')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Contact Name
                              {sortColumn === 'contactName' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('email')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Email
                              {sortColumn === 'email' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('phone')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Phone
                              {sortColumn === 'phone' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('source')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Source
                              {sortColumn === 'source' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Priority
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Status
                              {sortColumn === 'status' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('createdDate')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Created Date
                              {sortColumn === 'createdDate' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort('updatedAt')}
                          >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Last Updated
                              {sortColumn === 'updatedAt' && (
                                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Follow-Up
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedLeads.map((lead) => {
                          const leadId = getLeadId(lead)
                          const contactName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || 'N/A'
                          const getSourceLabel = (source) => {
                            const labels = {
                              website: 'Website',
                              phone: 'Phone',
                              email: 'Email',
                              walk_in: 'Walk In',
                              referral: 'Referral',
                              social_media: 'Social Media',
                              other: 'Other'
                            }
                            return labels[source] || source || 'Other'
                          }
                          const getStatusLabel = (status) => {
                            if (!status) return 'New Lead'
                            const statusLabels = {
                              new: 'New Lead',
                              contacted: 'Contacted',
                              qualified: 'Qualified',
                              site_visit_scheduled: 'Site Visit Scheduled',
                              site_visit_completed: 'Site Visit Completed',
                              negotiation: 'Negotiation',
                              booked: 'Booked',
                              lost: 'Lost',
                              closed: 'Closed',
                              junk: 'Junk / Invalid'
                            }
                            return statusLabels[status?.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
                          }

                          const getPriorityLabel = (priority) => {
                            if (!priority) return 'Warm'
                            const priorityLabels = {
                              Hot: 'Hot',
                              Warm: 'Warm',
                              Cold: 'Cold',
                              Not_interested: 'Not Interested'
                            }
                            const p = String(priority).toLowerCase()
                            const key = Object.keys(priorityLabels).find(k => k.toLowerCase() === p)
                            return priorityLabels[key] || priority.charAt(0).toUpperCase() + priority.slice(1)
                          }
                          return (
                            <tr key={leadId} className="hover:bg-logo-beige transition-colors">
                              {canBulkActions && (
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedLeads.includes(leadId)}
                                    onChange={() => handleSelectLead(leadId)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-mono text-gray-600">
                                  {lead.leadId || `LEAD-${String(lead._id).slice(-6)}`}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {lead.score !== undefined ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${lead.score >= 70 ? 'bg-red-500' :
                                          lead.score >= 40 ? 'bg-orange-500' :
                                            lead.score >= 20 ? 'bg-yellow-500' : 'bg-gray-400'
                                          }`}
                                        style={{ width: `${Math.min(lead.score, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 min-w-[35px]">{lead.score}</span>
                                    <button
                                      onClick={() => handleReScoreLead(leadId)}
                                      disabled={rescoring === leadId}
                                      className="text-primary-600 hover:text-primary-800 disabled:opacity-50"
                                      title="Re-score lead"
                                    >
                                      <Zap className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleReScoreLead(leadId)}
                                    disabled={rescoring === leadId}
                                    className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
                                    title="Calculate score"
                                  >
                                    {rescoring === leadId ? 'Scoring...' : 'Score'}
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => { setViewLead(lead); setShowViewModal(true); }}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 text-left"
                                >
                                  {contactName}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">{lead.contact?.email || '-'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">{lead.contact?.phone || '-'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900 capitalize">
                                  {getSourceLabel(lead.source)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                {canEditLead ? (
                                  <select
                                    key={`priority-select-${leadId}-${lead.priority || 'null'}`}
                                    value={lead.priority ? String(lead.priority).charAt(0).toUpperCase() + String(lead.priority).slice(1).toLowerCase() : ''}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      handleQuickPriorityChange(leadId, e.target.value)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[120px] cursor-pointer"
                                    title="Change Priority"
                                  >
                                    <option value="">Select Priority</option>
                                    <option value="Hot">Hot</option>
                                    <option value="Warm">Warm</option>
                                    <option value="Cold">Cold</option>
                                    <option value="Not_interested">Not Interested</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${String(lead.priority).toLowerCase() === 'hot' ? 'bg-red-100 text-red-800' :
                                    String(lead.priority).toLowerCase() === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                                      String(lead.priority).toLowerCase() === 'cold' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1).replace('_', ' ') : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {canEditLead ? (
                                  <select
                                    value={lead.status || ''}
                                    onChange={(e) => handleQuickStatusChange(leadId, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[140px]
                                      ${lead.status === 'booked' || lead.status === 'closed' ? 'bg-green-50 text-green-800 border-green-200' :
                                        lead.status === 'lost' || lead.status === 'junk' ? 'bg-red-50 text-red-800 border-red-200' :
                                          lead.status === 'new' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                            'bg-primary-50 text-primary-800 border-primary-200'}`}
                                    title="Change Status"
                                  >
                                    <option value="">Select Status</option>
                                    <option value="new">New Lead</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="site_visit_scheduled">Site Visit Scheduled</option>
                                    <option value="site_visit_completed">Site Visit Completed</option>
                                    <option value="negotiation">Negotiation</option>
                                    <option value="booked">Booked</option>
                                    <option value="lost">Lost</option>
                                    <option value="closed">Closed</option>
                                    <option value="junk">Junk / Invalid</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${lead.status === 'booked' || lead.status === 'closed' ? 'bg-green-100 text-green-800' :
                                    lead.status === 'lost' || lead.status === 'junk' ? 'bg-red-100 text-red-800' :
                                      'bg-primary-100 text-primary-800'
                                    }`}>
                                    {lead.status ? lead.status.replace(/_/g, ' ').charAt(0).toUpperCase() + lead.status.replace(/_/g, ' ').slice(1) : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {lead.updatedAt ? (
                                  <div className="flex flex-col">
                                    <span>{new Date(lead.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    <span className="text-xs text-gray-500">{new Date(lead.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {lead.followUpDate ? (
                                  <div className="flex flex-col">
                                    <span className={new Date(lead.followUpDate) < new Date() ? 'text-red-600 font-semibold' : ''}>
                                      {new Date(lead.followUpDate).toLocaleDateString()}
                                    </span>
                                    {new Date(lead.followUpDate) < new Date() && (
                                      <span className="text-xs text-red-500">Overdue</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex items-center justify-center gap-2">
                                  {checkEntryPermission(lead, user, 'view', canViewLeads) && (
                                    <button
                                      type="button"
                                      onClick={() => { setViewLead(lead); setShowViewModal(true); }}
                                      className="text-primary-600 hover:text-primary-900 transition-colors"
                                      title="View"
                                    >
                                      <Eye className="h-5 w-5" />
                                    </button>
                                  )}
                                  {checkEntryPermission(lead, user, 'edit', canEditLead) && (
                                    <button
                                      type="button"
                                      onClick={() => { setEditLeadId(leadId); setShowEditModal(true); }}
                                      className="text-primary-600 hover:text-primary-900 transition-colors"
                                      title="Edit"
                                    >
                                      <Edit className="h-5 w-5" />
                                    </button>
                                  )}
                                  {canDeleteLead && (
                                    <button
                                      onClick={() => handleDelete(leadId)}
                                      className="text-red-600 hover:text-red-900 transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination - hidden when printing */}
                  <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200 no-print">
                    <div className="text-sm text-gray-700">
                      {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}/{pagination.total}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        «
                      </button>
                      <button
                        className="px-3 py-1 bg-primary-600 text-white rounded-lg"
                      >
                        {pagination.page}
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page >= pagination.pages}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        »
                      </button>
                    </div>
                  </div>
                </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Kanban View - hidden when printing */}
        {viewMode === 'kanban' && (
          loading ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanColumns.map((column) => (
                <div key={column.id} className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{column.title}</h3>
                    <div className={`h-1 rounded-full ${column.colorClass}`}></div>
                  </div>
                  <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/3 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (!allLeads || allLeads.length === 0) ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500 text-lg">No leads found</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or add new leads</p>
            </div>
          ) : (
            <>
              {kanbanLeadsCapped && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Displaying up to 2,000 leads for optimal performance. Use filters to narrow down results.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {kanbanColumns.map((column) => {
                const columnLeads = getLeadsByStatus(column.id)
                const isDraggedOver = draggedOverColumn === column.id
                return (
                  <div
                    key={column.id}
                    className={`flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4 transition-colors ${isDraggedOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}`}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{column.title}</h3>
                        <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded-full">
                          {columnLeads.length}
                        </span>
                      </div>
                      <div className={`h-1 rounded-full ${column.colorClass}`}></div>
                    </div>
                    <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {columnLeads.map((lead) => {
                        const leadId = getLeadId(lead)
                        const contactName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || 'N/A'
                        const isDragging = draggedLead && getLeadId(draggedLead) === leadId
                        const getStatusLabel = (status) => {
                          if (!status) return 'New Lead'
                          const statusLabels = {
                            new: 'New Lead',
                            contacted: 'Contacted',
                            qualified: 'Qualified',
                            site_visit_scheduled: 'Site Visit Scheduled',
                            site_visit_completed: 'Site Visit Completed',
                            negotiation: 'Negotiation',
                            booked: 'Booked',
                            lost: 'Lost',
                            closed: 'Closed',
                            junk: 'Junk / Invalid'
                          }
                          return statusLabels[status?.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
                        }
                        const getPriorityColor = (priority) => {
                          if (!priority) return 'bg-gray-100 text-gray-800'
                          const p = String(priority).toLowerCase()
                          if (p === 'hot') return 'bg-red-100 text-red-800'
                          if (p === 'warm') return 'bg-orange-100 text-orange-800'
                          if (p === 'cold') return 'bg-blue-100 text-blue-800'
                          return 'bg-gray-100 text-gray-800'
                        }
                        const getPriorityLabel = (priority) => {
                          if (!priority) return 'Warm'
                          const priorityLabels = {
                            Hot: 'Hot',
                            Warm: 'Warm',
                            Cold: 'Cold',
                            Not_interested: 'Not Interested'
                          }
                          const p = String(priority).toLowerCase()
                          const key = Object.keys(priorityLabels).find(k => k.toLowerCase() === p)
                          return priorityLabels[key] || priority.charAt(0).toUpperCase() + priority.slice(1)
                        }
                        return (
                          <div
                            key={leadId}
                            draggable
                            onDragStart={(e) => handleDragStart(e, lead)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-move border border-gray-200 ${isDragging ? 'opacity-50' : 'hover:border-primary-300'}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!draggedLead && !isDragging) {
                                setViewLead(lead)
                                setShowViewModal(true)
                              }
                            }}
                          >
                            {/* Lead Name */}
                            <h4 className="text-sm font-medium text-gray-900 mb-2 truncate">{contactName}</h4>
                            
                            {/* Two Column Layout */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* Left Column */}
                              <div className="space-y-1.5">
                                {/* Status */}
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(lead.status)}`}>
                                    {getStatusLabel(lead.status)}
                                  </span>
                                </div>
                                
                                {/* Follow Up with Icon */}
                                {lead.followUpDate ? (
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className={`h-3.5 w-3.5 ${new Date(lead.followUpDate) < new Date() ? 'text-red-500' : 'text-gray-500'}`} />
                                    <span className={`text-xs ${new Date(lead.followUpDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                      {new Date(lead.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-gray-300" />
                                    <span className="text-xs text-gray-400">No follow-up</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Right Column */}
                              <div className="space-y-1.5">
                                {/* Priority */}
                                <div className="flex items-center justify-end">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(lead.priority)}`}>
                                    {getPriorityLabel(lead.priority)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {columnLeads.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          No leads
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Preview Upload ({uploadedData.length} leads)
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadedData([])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 text-sm text-gray-600">
                  Review the leads below. Invalid rows have been filtered out.
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadedData.slice(0, 10).map((lead, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">
                            {lead.contact.firstName} {lead.contact.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm">{lead.contact.email}</td>
                          <td className="px-4 py-3 text-sm">{lead.contact.phone}</td>
                          <td className="px-4 py-3 text-sm">{lead.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadedData.length > 10 && (
                    <div className="mt-4 text-sm text-gray-600 text-center">
                      ... and {uploadedData.length - 10} more leads
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadedData([])
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : `Upload ${uploadedData.length} Leads`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {showErrorModal && uploadErrors.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-red-600">
                  Upload Errors ({uploadErrors.length} rows)
                </h2>
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setUploadErrors([])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 text-sm text-gray-600">
                  The following rows had errors and were not uploaded.
                </div>
                <div className="space-y-2">
                  {uploadErrors.map((error, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-red-700">Row {error.row}:</span>
                        <span className="text-red-600">{error.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t">
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setUploadErrors([])
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Bulk Update Status</h2>
                <button
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkAction('')
                    setBulkStatus('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  You are about to update <strong>{selectedLeads.length}</strong> lead(s)
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Status</option>
                    <option value="new">New Lead</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="site_visit_scheduled">Site Visit Scheduled</option>
                    <option value="site_visit_completed">Site Visit Completed</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="booked">Booked</option>
                    <option value="lost">Lost</option>
                    <option value="closed">Closed</option>
                    <option value="junk">Junk / Invalid</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t">
                <button
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkAction('')
                    setBulkStatus('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdateStatus}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Source & Agent Performance Widgets */}
        {dashboardMetrics && (dashboardMetrics.leadSourcePerformance || dashboardMetrics.salesExecutivePerformance) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Source Performance */}
            {dashboardMetrics.leadSourcePerformance && Object.keys(dashboardMetrics.leadSourcePerformance).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary-600" />
                  Lead Source Performance
                </h3>
                <div className="space-y-3">
                  {Object.entries(dashboardMetrics.leadSourcePerformance)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 5)
                    .map(([source, data]) => (
                      <div key={source} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 capitalize">{source.replace('_', ' ')}</span>
                          <span className="text-xs text-gray-500">{data.conversionRate}% conversion</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>Total: {data.total}</span>
                          <span>•</span>
                          <span>Converted: {data.converted}</span>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${data.conversionRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Agent Performance */}
            {dashboardMetrics.salesExecutivePerformance && dashboardMetrics.salesExecutivePerformance.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary-600" />
                  Sales Executive Performance
                </h3>
                <div className="space-y-3">
                  {dashboardMetrics.salesExecutivePerformance
                    .sort((a, b) => b.convertedLeads - a.convertedLeads)
                    .slice(0, 5)
                    .map((agent) => {
                      const agentData = owners.find(o => o._id?.toString() === agent.agentId)
                      return (
                        <div key={agent.agentId} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {agentData ? `${agentData.firstName} ${agentData.lastName}` : `Agent ${agent.agentId.slice(-6)}`}
                            </span>
                            <span className="text-xs text-gray-500">{agent.conversionRate}% conversion</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>Total: {agent.totalLeads}</span>
                            <span>•</span>
                            <span>Converted: {agent.convertedLeads}</span>
                          </div>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${agent.conversionRate}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <EntryPermissionModal
        isOpen={!!permissionModalEntry}
        onClose={() => setPermissionModalEntry(null)}
        entry={permissionModalEntry}
        entryType="leads"
        onSuccess={fetchLeads}
      />

      <AddLeadModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchLeads}
      />
      <LeadDetailsModal
        open={showViewModal}
        lead={viewLead}
        onClose={() => { setShowViewModal(false); setViewLead(null); }}
        onEdit={(lead) => {
          setShowViewModal(false)
          setViewLead(null)
          setEditLeadId(lead?._id || lead?.leadId)
          setShowEditModal(true)
        }}
        canEdit={canEditLead}
      />
      <EditLeadModal
        open={showEditModal}
        leadId={editLeadId}
        onClose={() => { setShowEditModal(false); setEditLeadId(null); }}
        onSuccess={fetchLeads}
      />
    </DashboardLayout>
  )
}

