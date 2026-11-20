//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	userenv  = syscall.NewLazyDLL("userenv.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")
	ntdll    = syscall.NewLazyDLL("ntdll.dll")

	procFreeSid = advapi32.NewProc("FreeSid")

	procCreateJobObjectW                  = kernel32.NewProc("CreateJobObjectW")
	procSetInformationJobObject           = kernel32.NewProc("SetInformationJobObject")
	procQueryInformationJobObject         = kernel32.NewProc("QueryInformationJobObject")
	procAssignProcessToJobObject          = kernel32.NewProc("AssignProcessToJobObject")
	procTerminateJobObject                = kernel32.NewProc("TerminateJobObject")
	procInitializeProcThreadAttributeList = kernel32.NewProc("InitializeProcThreadAttributeList")
	procUpdateProcThreadAttribute         = kernel32.NewProc("UpdateProcThreadAttribute")
	procDeleteProcThreadAttributeList     = kernel32.NewProc("DeleteProcThreadAttributeList")
	procCreateProcessW                    = kernel32.NewProc("CreateProcessW")
	procResumeThread                      = kernel32.NewProc("ResumeThread")
	procSetErrorMode                      = kernel32.NewProc("SetErrorMode")
	procGetQueuedCompletionStatus         = kernel32.NewProc("GetQueuedCompletionStatus")
	procLocalFree                         = kernel32.NewProc("LocalFree")

	procCreateAppContainerProfile                 = userenv.NewProc("CreateAppContainerProfile")
	procDeriveAppContainerSidFromAppContainerName = userenv.NewProc("DeriveAppContainerSidFromAppContainerName")
	procDeleteAppContainerProfile                 = userenv.NewProc("DeleteAppContainerProfile")

	procSetEntriesInAclW       = advapi32.NewProc("SetEntriesInAclW")
	procGetNamedSecurityInfoW  = advapi32.NewProc("GetNamedSecurityInfoW")
	procSetNamedSecurityInfoW  = advapi32.NewProc("SetNamedSecurityInfoW")
	procConvertSidToStringSidW = advapi32.NewProc("ConvertSidToStringSidW")
	procConvertStringSidToSidW = advapi32.NewProc("ConvertStringSidToSidW")
	procGetAclInformation      = advapi32.NewProc("GetAclInformation")
	procGetAce                 = advapi32.NewProc("GetAce")
	procEqualSid               = advapi32.NewProc("EqualSid")
)

const (
	jobObjectBasicAccountingInformation       = 1
	jobObjectBasicUIRestrictions              = 4
	jobObjectAssociateCompletionPortInfo      = 7
	jobObjectExtendedLimitInformation         = 9
	jobLimitJobTime                           = 0x4
	jobLimitActiveProcess                     = 0x8
	jobLimitProcessMemory                     = 0x100
	jobLimitJobMemory                         = 0x200
	jobLimitDieOnUnhandledException           = 0x400
	jobLimitKillOnJobClose                    = 0x2000
	jobMsgEndOfJobTime                        = 1
	jobMsgActiveProcessLimit                  = 3
	jobMsgProcessMemoryLimit                  = 9
	jobMsgJobMemoryLimit                      = 10
	procThreadAttributeHandleList             = 0x00020002
	procThreadAttributeSecurityCapabilities   = 0x00020009
	extendedStartupinfoPresent                = 0x00080000
	createSuspended                           = 0x00000004
	createUnicodeEnvironment                  = 0x00000400
	createNoWindow                            = 0x08000000
	semFailCriticalErrors                     = 0x0001
	semNoGPFaultErrorBox                      = 0x0002
	semNoOpenFileErrorBox                     = 0x8000
	seFileObject                              = 1
	daclSecurityInformation                   = 4
	grantAccess                               = 1
	subContainersAndObjectsInherit            = 3
	trusteeIsSid                              = 0
	trusteeIsWellKnownGroup                   = 5
	fileAllAccess                             = 0x1F01FF
	fileGenericReadExecute                    = 0x1200A9
	hresultAlreadyExists                      = 0x800700B7
	accessAllowedAceType                      = 0
)

type jobBasicLimit struct {
	PerProcessUserTimeLimit int64
	PerJobUserTimeLimit     int64
	LimitFlags              uint32
	MinimumWorkingSetSize   uintptr
	MaximumWorkingSetSize   uintptr
	ActiveProcessLimit      uint32
	Affinity                uintptr
	PriorityClass           uint32
	SchedulingClass         uint32
}

type ioCounters struct {
	ReadOperationCount, WriteOperationCount, OtherOperationCount uint64
	ReadTransferCount, WriteTransferCount, OtherTransferCount    uint64
}

type jobExtendedLimit struct {
	Basic                 jobBasicLimit
	Io                    ioCounters
	ProcessMemoryLimit    uintptr
	JobMemoryLimit        uintptr
	PeakProcessMemoryUsed uintptr
	PeakJobMemoryUsed     uintptr
}

type jobAccounting struct {
	TotalUserTime             int64
	TotalKernelTime           int64
	ThisPeriodTotalUserTime   int64
	ThisPeriodTotalKernelTime int64
	TotalPageFaultCount       uint32
	TotalProcesses            uint32
	ActiveProcesses           uint32
	TotalTerminatedProcesses  uint32
}

type jobCompletionPort struct {
	CompletionKey  uintptr
	CompletionPort syscall.Handle
}

type securityCapabilities struct {
	AppContainerSid uintptr
	Capabilities    uintptr
	CapabilityCount uint32
	Reserved        uint32
}

type startupInfoEx struct {
	syscall.StartupInfo
	AttributeList uintptr
}

type trustee struct {
	MultipleTrustee          uintptr
	MultipleTrusteeOperation uint32
	TrusteeForm              uint32
	TrusteeType              uint32
	Name                     uintptr
}

type explicitAccess struct {
	AccessPermissions uint32
	AccessMode        uint32
	Inheritance       uint32
	Trustee           trustee
}

type aclSizeInfo struct {
	AceCount      uint32
	AclBytesInUse uint32
	AclBytesFree  uint32
}

type aceHeader struct {
	AceType  byte
	AceFlags byte
	AceSize  uint16
}

func utf16Ptr(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

// appContainerSid creates (or reuses) a named AppContainer profile and returns its SID.
// The profile has no capabilities, so processes inside it have no network access and can
// only open objects whose ACL explicitly grants the container (or ALL APPLICATION PACKAGES).
func appContainerSid(name string) (uintptr, error) {
	var createdSid uintptr
	r, _, _ := procCreateAppContainerProfile.Call(
		uintptr(unsafe.Pointer(utf16Ptr(name))),
		uintptr(unsafe.Pointer(utf16Ptr(name))),
		uintptr(unsafe.Pointer(utf16Ptr("Offline CFOJ judge sandbox"))),
		0, 0, uintptr(unsafe.Pointer(&createdSid)))
	if createdSid != 0 {
		procFreeSid.Call(createdSid)
	}
	var sid uintptr
	r2, _, _ := procDeriveAppContainerSidFromAppContainerName.Call(
		uintptr(unsafe.Pointer(utf16Ptr(name))), uintptr(unsafe.Pointer(&sid)))
	if r2 != 0 {
		if r != 0 {
			return 0, syscall.Errno(r)
		}
		return 0, syscall.Errno(r2)
	}
	return sid, nil
}

func parseSid(s string) (uintptr, error) {
	var sid uintptr
	r, _, e := procConvertStringSidToSidW.Call(uintptr(unsafe.Pointer(utf16Ptr(s))), uintptr(unsafe.Pointer(&sid)))
	if r == 0 {
		return 0, e
	}
	return sid, nil
}

func sidString(sid uintptr) string {
	var p *uint16
	r, _, _ := procConvertSidToStringSidW.Call(sid, uintptr(unsafe.Pointer(&p)))
	if r == 0 {
		return ""
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(p)))
	return syscall.UTF16ToString((*[1 << 16]uint16)(unsafe.Pointer(p))[:])
}

// hasAllowAce reports whether path's DACL already contains an allow ACE for sid with all mask bits.
func hasAllowAce(path string, sid uintptr, mask uint32) bool {
	var dacl, sd uintptr
	r, _, _ := procGetNamedSecurityInfoW.Call(uintptr(unsafe.Pointer(utf16Ptr(path))), seFileObject,
		daclSecurityInformation, 0, 0, uintptr(unsafe.Pointer(&dacl)), 0, uintptr(unsafe.Pointer(&sd)))
	if r != 0 || dacl == 0 {
		return false
	}
	defer procLocalFree.Call(sd)
	var info aclSizeInfo
	r, _, _ = procGetAclInformation.Call(dacl, uintptr(unsafe.Pointer(&info)), unsafe.Sizeof(info), 2)
	if r == 0 {
		return false
	}
	for i := uint32(0); i < info.AceCount; i++ {
		var ace unsafe.Pointer
		if r, _, _ := procGetAce.Call(dacl, uintptr(i), uintptr(unsafe.Pointer(&ace))); r == 0 {
			continue
		}
		h := (*aceHeader)(ace)
		if h.AceType != accessAllowedAceType {
			continue
		}
		aceMask := *(*uint32)(unsafe.Add(ace, 4))
		aceSid := uintptr(unsafe.Add(ace, 8))
		if eq, _, _ := procEqualSid.Call(aceSid, sid); eq != 0 && aceMask&mask == mask {
			return true
		}
	}
	return false
}

// grantPath adds an inheritable allow ACE for sid to path (propagated to existing children).
func grantPath(path string, sid uintptr, mask uint32) error {
	if hasAllowAce(path, sid, mask) {
		return nil
	}
	var oldDacl, sd uintptr
	r, _, _ := procGetNamedSecurityInfoW.Call(uintptr(unsafe.Pointer(utf16Ptr(path))), seFileObject,
		daclSecurityInformation, 0, 0, uintptr(unsafe.Pointer(&oldDacl)), 0, uintptr(unsafe.Pointer(&sd)))
	if r != 0 {
		return syscall.Errno(r)
	}
	defer procLocalFree.Call(sd)
	ea := explicitAccess{
		AccessPermissions: mask,
		AccessMode:        grantAccess,
		Inheritance:       subContainersAndObjectsInherit,
		Trustee:           trustee{TrusteeForm: trusteeIsSid, TrusteeType: trusteeIsWellKnownGroup, Name: sid},
	}
	var newDacl uintptr
	r, _, _ = procSetEntriesInAclW.Call(1, uintptr(unsafe.Pointer(&ea)), oldDacl, uintptr(unsafe.Pointer(&newDacl)))
	if r != 0 {
		return syscall.Errno(r)
	}
	defer procLocalFree.Call(newDacl)
	r, _, _ = procSetNamedSecurityInfoW.Call(uintptr(unsafe.Pointer(utf16Ptr(path))), seFileObject,
		daclSecurityInformation, 0, 0, newDacl, 0)
	if r != 0 {
		return syscall.Errno(r)
	}
	return nil
}
