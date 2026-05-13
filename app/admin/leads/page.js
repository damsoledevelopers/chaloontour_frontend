'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '../../../components/Layout/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { api } from '../../../lib/api'
import { Search, Phone, Mail, MapPin, Calendar, User, Plus, Edit, Eye, Trash2, Upload, X, Users, UserCheck, TrendingUp, CheckCircle, UserX, AlertCircle, ArrowUp, FileText, Printer, RefreshCw, ChevronUp, ChevronDown, MoreHorizontal, Clock, Package, BarChart3, Bell, Target, Zap, Shield, Activity, ShieldCheck, Copy as CopyIcon } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import AddLeadModal from '../../../components/Leads/AddLeadModal'
import LeadDetailsModal from '../../../components/Leads/LeadDetailsModal'
import EditLeadModal from '../../../components/Leads/EditLeadModal'
import { checkEntryPermission, canDeleteLead as canDeleteLeadFn, canUploadExcel as canUploadExcelFn, canCreateLead as canCreateLeadFn, canAssignLead as canAssignLeadFn } from '../../../lib/permissions'
import { getLeadsPath, getRoleHomePath, getScopedPath } from '../../../lib/appPaths'

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

function AdminLeadsPageContent() {
  const { user, loading: authLoading, checkPermission } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadsPath = getLeadsPath(user)
  const dashboardPath = getRoleHomePath(user)
  const tourPdfPath = getScopedPath(user, '/tour-pdf')

  // Open modal from query (e.g. /admin/leads?add=1, ?view=id, ?edit=id)
  useEffect(() => {
    if (authLoading || !user) return
    const add = searchParams.get('add')
    const viewId = searchParams.get('view')
    const editId = searchParams.get('edit')
    if (add === '1') {
      setShowAddModal(true)
      router.replace(leadsPath, { scroll: false })
    } else if (viewId) {
      setEditLeadId(null)
      setShowEditModal(false)
      api.get(`/leads/${viewId}`).then((r) => {
        setViewLead(r.data.lead)
        setShowViewModal(true)
      }).catch(() => toast.error('Lead not found'))
      router.replace(leadsPath, { scroll: false })
    } else if (editId) {
      setViewLead(null)
      setShowViewModal(false)
      setEditLeadId(editId)
      setShowEditModal(true)
      router.replace(leadsPath, { scroll: false })
    }
  }, [searchParams, authLoading, user, leadsPath, router])

  // Role-based access control
  useEffect(() => {
    if (!authLoading && user) {
      if (!checkPermission('leads', 'view')) {
        toast.error('You do not have permission to view Leads')
        router.push(dashboardPath)
      }
    }
  }, [user, authLoading, router, checkPermission, dashboardPath])

  // Role-based feature visibility
  const isSuperAdmin = user?.role === 'superadmin'
  const isStaff = user?.role === 'staff'

  // Permissions: superadmin full; staff can add/upload like superadmin; staff view/edit assigned only; no delete/assign (bulk)
  const canViewLeads = true
  const canCreateLead = canCreateLeadFn(user)
  const canEditLead = true
  const canDeleteLead = canDeleteLeadFn(user)
  const canUploadExcelBtn = canUploadExcelFn(user)
  const canAssignLeadBtn = isSuperAdmin && canAssignLeadFn(user)

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
  const [properties, setProperties] = useState([])
  const isUploadingRef = useRef(false)
  const [selectedLeads, setSelectedLeads] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkAgent, setBulkAgent] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [dashboardMetrics, setDashboardMetrics] = useState(null)
  const [missedFollowUps, setMissedFollowUps] = useState(0)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [reportingManagers, setReportingManagers] = useState([])
  const [teams, setTeams] = useState([])
  const [rescoring, setRescoring] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null)
  const [draggedLead, setDraggedLead] = useState(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState(null)
  const [kanbanLeadsCapped, setKanbanLeadsCapped] = useState(false)
  const [filterChangeTimer, setFilterChangeTimer] = useState(null)
  const metadataFetchedRef = useRef(false)
  const lastFilterStateRef = useRef(null)
  const bulkFileInputRef = useRef(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewLead, setViewLead] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLeadId, setEditLeadId] = useState(null)
  const [showUploadExcelModal, setShowUploadExcelModal] = useState(false)
  const [uploadExcelFile, setUploadExcelFile] = useState(null)
  const [uploadExcelLoading, setUploadExcelLoading] = useState(false)
  const [duplicatingLeadId, setDuplicatingLeadId] = useState(null)

  const insertLeadBelowSource = (existingLeads, sourceLeadId, duplicatedLead) => {
    const nextLeads = [...existingLeads]
    const sourceIndex = nextLeads.findIndex(item => String(item?._id) === String(sourceLeadId))

    if (sourceIndex === -1) {
      nextLeads.unshift(duplicatedLead)
      return nextLeads
    }

    nextLeads.splice(sourceIndex + 1, 0, duplicatedLead)
    return nextLeads
  }

  const handleCopyLead = async (lead) => {
    try {
      if (!lead) return

      const sourceLeadId = String(lead._id || '')
      if (!sourceLeadId) {
        toast.error('Could not duplicate lead')
        return
      }

      setDuplicatingLeadId(sourceLeadId)
      const response = await api.post(`/leads/${sourceLeadId}/duplicate`)
      const duplicatedLead = response.data?.lead

      if (!duplicatedLead) {
        throw new Error('No duplicated lead returned')
      }

      setLeads(prevLeads => insertLeadBelowSource(prevLeads, sourceLeadId, duplicatedLead))
      setAllLeads(prevLeads => (
        prevLeads.length > 0
          ? insertLeadBelowSource(prevLeads, sourceLeadId, duplicatedLead)
          : prevLeads
      ))
      setPagination(prev => {
        const nextTotal = (prev.total || 0) + 1
        return {
          ...prev,
          total: nextTotal,
          pages: Math.max(1, Math.ceil(nextTotal / Math.max(prev.limit || 1, 1)))
        }
      })

      fetchDashboardMetrics()
      fetchMissedFollowUps()
      toast.success('Lead duplicated successfully')
    } catch (error) {
      console.error('Failed to duplicate lead:', error)
      toast.error(error.response?.data?.message || 'Could not duplicate lead')
    } finally {
      setDuplicatingLeadId(null)
    }
  }

  const handleOpenLeadPdfPreview = (lead) => {
    const leadId = String(lead?._id || '')
    if (!leadId) {
      toast.error('Lead not found')
      return
    }

    router.push(`${tourPdfPath}?leadId=${encodeURIComponent(leadId)}&preview=1`)
  }

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
      property: filters.property,
      reportingManager: filters.reportingManager,
      team: filters.team,
      priority: filters.priority,
      search: filters.search,
      page: pagination.page,
      limit: pagination.limit,
      missed: searchParams.get('missed'),
      recent: searchParams.get('recent')
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
  }, [filters, pagination.page, pagination.limit, user, authLoading, viewMode, searchParams])



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
          if (searchParams.get('missed') === '1') {
            kanbanParams.append('missed', '1')
          }
          if (searchParams.get('recent') === '1') {
            kanbanParams.append('recent', '1')
          }
          
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
              console.log('Lead filtered out by permissions:', lead._id, lead.name)
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
        if (searchParams.get('missed') === '1') {
          params.append('missed', '1')
        }
        if (searchParams.get('recent') === '1') {
          params.append('recent', '1')
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
      if (user?.role === 'superadmin' || user?.role === 'staff') {
        const res = await api.get('/users')
        const userList = res.data.users || []
        setOwners(userList)
        setAllAgents(userList)
      } else {
        setOwners([])
        setAllAgents([])
      }
      const responseLeads = await api.get('/leads?limit=500')
      const allLeadsData = responseLeads.data.leads || []
      const uniqueSources = [...new Set(allLeadsData.map(lead => lead.source).filter(Boolean))]
      setSources(uniqueSources)
    } catch (error) {
      console.error('Error fetching owners:', error)
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
    if (!canAssignLeadBtn) return
    const currentLead = leads.find(lead => String(getLeadId(lead)) === String(leadId))
    const currentId = currentLead?.assigned_to?._id ? String(currentLead.assigned_to._id) : (currentLead?.assigned_to ? String(currentLead.assigned_to) : null)
    const newAgentId = agentId ? String(agentId) : null
    if (currentId === newAgentId) return

    let previousLeadsState = null
    let previousAllLeadsState = null
    const assignedUser = agentId ? owners.find(o => String(o._id) === String(agentId)) : null
    setLeads(prevLeads => {
      previousLeadsState = prevLeads
      return prevLeads.map(lead => {
        if (String(getLeadId(lead)) !== String(leadId)) return lead
        return { ...lead, assigned_to: assignedUser ? { _id: assignedUser._id, firstName: assignedUser.firstName, lastName: assignedUser.lastName } : null }
      })
    })
    setAllLeads(prevLeads => {
      previousAllLeadsState = prevLeads
      return prevLeads.map(lead => {
        if (String(getLeadId(lead)) !== String(leadId)) return lead
        return { ...lead, assigned_to: assignedUser ? { _id: assignedUser._id, firstName: assignedUser.firstName, lastName: assignedUser.lastName } : null }
      })
    })

    try {
      const response = await api.put(`/leads/${leadId}/assign`, { assigned_to: agentId })
      if (response.data?.lead) {
        const serverAssigned = response.data.lead.assigned_to
        setLeads(prev => prev.map(l => String(getLeadId(l)) === String(leadId) ? { ...l, assigned_to: serverAssigned } : l))
        setAllLeads(prev => prev.map(l => String(getLeadId(l)) === String(leadId) ? { ...l, assigned_to: serverAssigned } : l))
      }
      toast.success('Lead assigned successfully')
      fetchDashboardMetrics()
    } catch (error) {
      if (previousLeadsState) setLeads(previousLeadsState)
      if (previousAllLeadsState) setAllLeads(previousAllLeadsState)
      console.error('Error assigning lead:', error)
      toast.error('Failed to assign lead')
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
    if (!canAssignLeadBtn) return
    if (selectedLeads.length === 0 || !bulkAgent) {
      toast.error('Please select leads and an agent')
      return
    }

    try {
      const assignPromises = selectedLeads.map(id => api.put(`/leads/${id}/assign`, { assigned_to: bulkAgent }))
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
        'Name': lead.name?.trim() || 'N/A',
        'Email': lead.email || '-',
        'Phone': lead.phone || '-',
        'Source': lead.source === 'excel' ? 'Excel' : (lead.source || 'Manual'),
        'Assigned To': lead.assigned_to && typeof lead.assigned_to === 'object' ? `${lead.assigned_to.firstName || ''} ${lead.assigned_to.lastName || ''}`.trim() : 'Unassigned',
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
    { id: 'booked', title: 'Booked', colorClass: 'bg-green-400' },
    { id: 'lost', title: 'Lost', colorClass: 'bg-red-400' }
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
        }).filter((lead) => {
          const c = lead.contact
          if (!c) return false
          const hasName = Boolean(String(c.firstName || '').trim() || String(c.lastName || '').trim())
          const hasReach = Boolean(String(c.email || '').trim() || String(c.phone || '').trim())
          return hasName && hasReach
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

  const handleUploadExcelSubmit = async () => {
    if (!uploadExcelFile) {
      toast.error('Please select a file')
      return
    }
    const ext = (uploadExcelFile.name || '').toLowerCase().split('.').pop()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Only .xlsx or .csv files are allowed')
      return
    }
    setUploadExcelLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadExcelFile)
      const res = await api.post('/leads/upload', formData)
      const created = res.data.created ?? 0
      setShowUploadExcelModal(false)
      setUploadExcelFile(null)
      toast.success(`Successfully uploaded ${created} leads`)
      fetchLeads()
      fetchDashboardMetrics()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploadExcelLoading(false)
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4 min-w-0">
            <div className="flex items-center space-x-1 border-b border-gray-200 min-w-0 shrink-0">
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
            <div className="flex items-center gap-2 flex-wrap justify-end min-w-0 overflow-x-auto pb-1 -mx-1 px-1">
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              {canCreateLead && (
                <button type="button" onClick={() => setShowAddModal(true)} className="h-10 inline-flex items-center gap-2 px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-medium transition-colors shrink-0">
                  <Plus className="h-4 w-4" />
                  Add lead
                </button>
              )}
              {canUploadExcelBtn && (
                <>
                  <button type="button" onClick={() => bulkFileInputRef.current?.click()} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                    <Upload className="h-4 w-4" />
                    Import (preview)
                  </button>
                  <button type="button" onClick={() => setShowUploadExcelModal(true)} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Excel
                  </button>
                </>
              )}
              <button type="button" onClick={handleExportExcel} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                <FileText className="h-4 w-4" />
                Excel
              </button>
              <button type="button" onClick={handlePrint} className="h-10 inline-flex items-center gap-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                <Printer className="h-4 w-4" />
                Print
              </button>
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
                <option value="manual">Manual</option>
                <option value="excel">Excel</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="h-10 min-w-[140px] pl-4 pr-9 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%22')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              >
                <option value="">Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="booked">Booked</option>
                <option value="lost">Lost</option>
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
                      const name = lead.name?.trim() || '–'
                      const statusVal = (lead.status || 'new').charAt(0).toUpperCase() + (lead.status || 'new').slice(1)
                      const created = lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'
                      return (
                        <div key={getLeadId(lead)} className="border border-gray-200 rounded-lg overflow-hidden break-inside-avoid">
                          <div className="px-4 py-2 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{name}</span>
                            <span className="text-sm font-medium text-primary-700">{statusVal}</span>
                          </div>
                          <div className="p-4 text-sm">
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-900">{lead.phone || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{lead.email || '–'}</span></div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-500">Source</span><span className="font-medium text-gray-900">{lead.source || '–'}</span></div>
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Name
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Assigned To
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Total / Payment
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
                          <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedLeads.map((lead) => {
                          const leadId = getLeadId(lead)
                          const displayName = lead.name?.trim() || 'N/A'
                          const assignedTo = lead.assigned_to
                          const assignedName = assignedTo && (typeof assignedTo === 'object') ? `${assignedTo.firstName || ''} ${assignedTo.lastName || ''}`.trim() : '–'
                          const assignedId = assignedTo?._id || assignedTo
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => { setViewLead(lead); setShowViewModal(true); }}
                                  className="text-sm font-medium text-primary-600 hover:text-primary-800 text-left"
                                >
                                  {displayName}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{lead.email || '-'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{lead.phone || '-'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900 capitalize">{lead.source === 'excel' ? 'Excel' : (lead.source || 'Manual')}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {canAssignLeadBtn && owners.length > 0 ? (
                                  <select
                                    value={assignedId || ''}
                                    onChange={(e) => handleQuickAssign(leadId, e.target.value || null)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-w-[120px] cursor-pointer"
                                  >
                                    <option value="">Unassigned</option>
                                    {owners.map((u) => (<option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>))}
                                  </select>
                                ) : (
                                  <span className="text-sm text-gray-900">{assignedName}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {lead.total_amount != null ? Number(lead.total_amount) : '–'} / {lead.payment_status || '–'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {canEditLead ? (
                                  <select
                                    value={lead.status || ''}
                                    onChange={(e) => handleQuickStatusChange(leadId, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-sm px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-w-[120px] cursor-pointer
                                      ${lead.status === 'booked' ? 'bg-green-50 text-green-800 border-green-200' :
                                        lead.status === 'lost' ? 'bg-red-50 text-red-800 border-red-200' :
                                          lead.status === 'new' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                            'bg-primary-50 text-primary-800 border-primary-200'}`}
                                  >
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="booked">Booked</option>
                                    <option value="lost">Lost</option>
                                  </select>
                                ) : (
                                  <span className="text-sm font-medium">{lead.status ? String(lead.status).charAt(0).toUpperCase() + String(lead.status).slice(1) : '–'}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '–'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenLeadPdfPreview(lead)}
                                    className="text-primary-600 hover:text-primary-900 transition-colors"
                                    title="Open Tour PDF preview"
                                  >
                                    <FileText className="h-5 w-5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLead(lead)}
                                    disabled={duplicatingLeadId === leadId}
                                    className="text-primary-600 hover:text-primary-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Duplicate lead"
                                  >
                                    <CopyIcon className="h-5 w-5" />
                                  </button>
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
                        const displayName = lead.name?.trim() || 'N/A'
                        const isDragging = draggedLead && getLeadId(draggedLead) === leadId
                        const getStatusLabel = (status) => {
                          if (!status) return 'New'
                          const statusLabels = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', booked: 'Booked', lost: 'Lost' }
                          return statusLabels[status?.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1)
                        }
                        const nextFollowup = Array.isArray(lead.followups) && lead.followups.length > 0 ? lead.followups[lead.followups.length - 1] : null
                        const followupDate = nextFollowup?.date || null
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
                            <h4 className="text-sm font-medium text-gray-900 mb-2 truncate">{displayName}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(lead.status)}`}>
                                    {getStatusLabel(lead.status)}
                                  </span>
                                </div>
                                {followupDate ? (
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className={`h-3.5 w-3.5 ${new Date(followupDate) < new Date() ? 'text-red-500' : 'text-gray-500'}`} />
                                    <span className={`text-xs ${new Date(followupDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                      {new Date(followupDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-gray-300" />
                                    <span className="text-xs text-gray-400">No follow-up</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-1.5">
                                {lead.budget && <div className="text-xs text-gray-600">Budget: {lead.budget}</div>}
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

      <AddLeadModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); }}
        onSuccess={fetchLeads}
      />

      {showUploadExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Upload Excel</h2>
            <p className="text-sm text-gray-600 mb-3">Upload .xlsx or .csv in travel leads format. Required: Name, Email, Phone. Optional: Destination, Travel Date, Budget, Status, Notes, Package Cost, No of Pax, Pax Type, Vehicle Type, Hotel Category, Meal Plan, Tour Nights/Days, Tour Start/End Date, Pick up, Drop, Destinations, Package Inclusions/Exclusions, Payment Policy, Cancellation Policy. All data will appear in lead view.</p>
            <input
              type="file"
              accept=".xlsx,.csv,.xls"
              onChange={(e) => setUploadExcelFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium"
            />
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => { setShowUploadExcelModal(false); setUploadExcelFile(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button type="button" onClick={handleUploadExcelSubmit} disabled={!uploadExcelFile || uploadExcelLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">{uploadExcelLoading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

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


export default function AdminLeadsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    }>
      <AdminLeadsPageContent />
    </Suspense>
  )
}
