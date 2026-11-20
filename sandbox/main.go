//go:build windows

// cfoj-sandbox runs one program inside a capability-less Windows AppContainer (no network,
// no access to user files) and a Job Object that enforces CPU time, wall time, committed
// memory, process count and output size, then kills the whole process tree.
//
// Usage:
//   cfoj-sandbox run      < spec.json   (prints result JSON)
//   cfoj-sandbox grant  <container> <rx|rw> <path>...
//   cfoj-sandbox check  <container>
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"
)

type Spec struct {
	Container        string   `json:"container"`
	Args             []string `json:"args"`
	Cwd              string   `json:"cwd"`
	Env              []string `json:"env"`
	StdinFile        string   `json:"stdinFile"`
	StdoutFile       string   `json:"stdoutFile"`
	StderrFile       string   `json:"stderrFile"`
	TimeLimitMs      int64    `json:"timeLimitMs"`
	WallLimitMs      int64    `json:"wallLimitMs"`
	MemoryLimitBytes int64    `json:"memoryLimitBytes"`
	MaxProcesses     int      `json:"maxProcesses"`
	OutputLimitBytes int64    `json:"outputLimitBytes"`
	StderrLimitBytes int64    `json:"stderrLimitBytes"`
	GrantRW          []string `json:"grantRW"`
	NoContainer      bool     `json:"noContainer"`
}

type Result struct {
	Status          string `json:"status"` // OK RE TLE MLE OLE FAIL
	ExitCode        uint32 `json:"exitCode"`
	CpuMs           int64  `json:"cpuMs"`
	WallMs          int64  `json:"wallMs"`
	PeakMemoryBytes int64  `json:"peakMemoryBytes"`
	OutputBytes     int64  `json:"outputBytes"`
	Detail          string `json:"detail,omitempty"`
	ContainerSid    string `json:"containerSid,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: cfoj-sandbox run|grant|check")
		os.Exit(2)
	}
	procSetErrorMode.Call(semFailCriticalErrors | semNoGPFaultErrorBox | semNoOpenFileErrorBox)
	switch os.Args[1] {
	case "run":
		var spec Spec
		if err := json.NewDecoder(os.Stdin).Decode(&spec); err != nil {
			emit(Result{Status: "FAIL", Detail: "bad spec: " + err.Error()})
			return
		}
		emit(run(&spec))
	case "grant":
		if len(os.Args) < 5 {
			fmt.Fprintln(os.Stderr, "usage: cfoj-sandbox grant <container> <rx|rw> <path>...")
			os.Exit(2)
		}
		var sid uintptr
		var err error
		if strings.HasPrefix(os.Args[2], "S-1-15-") {
			sid, err = parseSid(os.Args[2])
		} else {
			sid, err = appContainerSid(os.Args[2])
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, "appcontainer:", err)
			os.Exit(1)
		}
		mask := uint32(fileGenericReadExecute)
		if os.Args[3] == "rw" {
			mask = fileAllAccess
		}
		for _, p := range os.Args[4:] {
			if err := grantPath(p, sid, mask); err != nil {
				fmt.Fprintf(os.Stderr, "grant %s: %v\n", p, err)
				os.Exit(1)
			}
		}
		fmt.Println(sidString(sid))
	case "check":
		name := "CFOJ.Check"
		if len(os.Args) > 2 {
			name = os.Args[2]
		}
		sid, err := appContainerSid(name)
		if err != nil {
			fmt.Fprintln(os.Stderr, "appcontainer:", err)
			os.Exit(1)
		}
		fmt.Println(sidString(sid))
	default:
		fmt.Fprintln(os.Stderr, "unknown command")
		os.Exit(2)
	}
}

func emit(r Result) {
	b, _ := json.Marshal(r)
	os.Stdout.Write(b)
	os.Stdout.Write([]byte("\n"))
}

func fail(format string, a ...any) Result {
	return Result{Status: "FAIL", Detail: fmt.Sprintf(format, a...)}
}

func envBlock(env []string) *uint16 {
	m := map[string]string{}
	baseKeys := []string{
		"SystemRoot", "SystemDrive", "windir", "COMSPEC", "PATHEXT",
		"OS", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
		"USERPROFILE", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP",
	}
	for _, k := range baseKeys {
		if v := os.Getenv(k); v != "" {
			m[strings.ToUpper(k)] = k + "=" + v
		}
	}
	for _, e := range env {
		if idx := strings.IndexByte(e, '='); idx > 0 {
			k := e[:idx]
			m[strings.ToUpper(k)] = e
		}
	}
	sorted := make([]string, 0, len(m))
	for _, kv := range m {
		sorted = append(sorted, kv)
	}
	sort.Slice(sorted, func(i, j int) bool { return strings.ToUpper(sorted[i]) < strings.ToUpper(sorted[j]) })
	var b []uint16
	for _, e := range sorted {
		u, _ := syscall.UTF16FromString(e)
		b = append(b, u...)
	}
	b = append(b, 0)
	if len(sorted) == 0 {
		b = append(b, 0)
	}
	return &b[0]
}

func inheritableFile(path string, write bool) (syscall.Handle, error) {
	sa := &syscall.SecurityAttributes{Length: uint32(unsafe.Sizeof(syscall.SecurityAttributes{})), InheritHandle: 1}
	if write {
		return syscall.CreateFile(utf16Ptr(path), syscall.GENERIC_WRITE, syscall.FILE_SHARE_READ, sa,
			syscall.CREATE_ALWAYS, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	}
	return syscall.CreateFile(utf16Ptr(path), syscall.GENERIC_READ, syscall.FILE_SHARE_READ, sa,
		syscall.OPEN_EXISTING, syscall.FILE_ATTRIBUTE_NORMAL, 0)
}

// pipe returns (parentRead, childWrite) where only childWrite is inheritable.
func pipe() (syscall.Handle, syscall.Handle, error) {
	var r, w syscall.Handle
	sa := &syscall.SecurityAttributes{Length: uint32(unsafe.Sizeof(syscall.SecurityAttributes{})), InheritHandle: 1}
	if err := syscall.CreatePipe(&r, &w, sa, 1<<16); err != nil {
		return 0, 0, err
	}
	syscall.SetHandleInformation(r, syscall.HANDLE_FLAG_INHERIT, 0)
	return r, w, nil
}

// drain copies a pipe into a file, keeping at most limit bytes. When hard is set, exceeding the
// limit calls onExceed (used for output-limit enforcement).
func drain(h syscall.Handle, path string, limit int64, hard bool, onExceed func(), total *int64, wg *sync.WaitGroup) {
	defer wg.Done()
	f := os.NewFile(uintptr(h), "pipe")
	defer f.Close()
	var out io.Writer = io.Discard
	if path != "" {
		if file, err := os.Create(path); err == nil {
			defer file.Close()
			out = file
		}
	}
	buf := make([]byte, 1<<16)
	var written int64
	exceeded := false
	for {
		n, err := f.Read(buf)
		if n > 0 {
			atomic.AddInt64(total, int64(n))
			if !exceeded {
				keep := int64(n)
				if limit > 0 && written+keep > limit {
					keep = limit - written
					exceeded = true
					if hard && onExceed != nil {
						onExceed()
					}
				}
				if keep > 0 {
					out.Write(buf[:keep])
					written += keep
				}
			}
		}
		if err != nil {
			return
		}
	}
}

func run(spec *Spec) Result {
	if len(spec.Args) == 0 {
		return fail("no command")
	}
	if spec.Container == "" {
		spec.Container = "CFOJ.Run"
	}
	if spec.MaxProcesses <= 0 {
		spec.MaxProcesses = 1
	}
	if spec.WallLimitMs <= 0 {
		spec.WallLimitMs = spec.TimeLimitMs*3 + 1000
	}
	if spec.StderrLimitBytes <= 0 {
		spec.StderrLimitBytes = 64 << 10
	}

	var sid uintptr
	var res Result
	if !spec.NoContainer {
		var err error
		sid, err = appContainerSid(spec.Container)
		if err != nil {
			return fail("cannot create AppContainer profile %q: %v", spec.Container, err)
		}
		res.ContainerSid = sidString(sid)
		for _, p := range spec.GrantRW {
			if err := grantPath(p, sid, fileAllAccess); err != nil {
				return fail("cannot grant sandbox access to %s: %v", p, err)
			}
		}
	}

	// Job object with limits and a completion port for limit notifications.
	job, _, e := procCreateJobObjectW.Call(0, 0)
	if job == 0 {
		return fail("CreateJobObject: %v", e)
	}
	defer syscall.CloseHandle(syscall.Handle(job))
	var lim jobExtendedLimit
	lim.Basic.LimitFlags = jobLimitActiveProcess | jobLimitKillOnJobClose | jobLimitDieOnUnhandledException
	lim.Basic.ActiveProcessLimit = uint32(spec.MaxProcesses)
	if spec.MemoryLimitBytes > 0 {
		lim.Basic.LimitFlags |= jobLimitJobMemory | jobLimitProcessMemory
		hardCap := uintptr(spec.MemoryLimitBytes + (8 << 20))
		lim.JobMemoryLimit = hardCap
		lim.ProcessMemoryLimit = hardCap
	}
	if spec.TimeLimitMs > 0 {
		// Hard backstop slightly above the CPU limit; precise accounting happens in the poll loop.
		lim.Basic.LimitFlags |= jobLimitJobTime
		lim.Basic.PerJobUserTimeLimit = (spec.TimeLimitMs + 200) * 10000
	}
	if r, _, e := procSetInformationJobObject.Call(job, jobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&lim)), unsafe.Sizeof(lim)); r == 0 {
		return fail("SetInformationJobObject(limits): %v", e)
	}
	ui := uint32(0xFF) // block desktop, clipboard, global atoms, display settings, exit windows...
	procSetInformationJobObject.Call(job, jobObjectBasicUIRestrictions, uintptr(unsafe.Pointer(&ui)), 4)
	port, err := syscall.CreateIoCompletionPort(syscall.InvalidHandle, 0, 0, 1)
	if err != nil {
		return fail("CreateIoCompletionPort: %v", err)
	}
	defer syscall.CloseHandle(port)
	cp := jobCompletionPort{CompletionKey: 1, CompletionPort: port}
	procSetInformationJobObject.Call(job, jobObjectAssociateCompletionPortInfo, uintptr(unsafe.Pointer(&cp)), unsafe.Sizeof(cp))

	// Standard handles.
	var stdin syscall.Handle
	if spec.StdinFile != "" {
		stdin, err = inheritableFile(spec.StdinFile, false)
	} else {
		stdin, err = inheritableFile("NUL", false)
	}
	if err != nil {
		return fail("open stdin: %v", err)
	}
	defer syscall.CloseHandle(stdin)
	outR, outW, err := pipe()
	if err != nil {
		return fail("pipe: %v", err)
	}
	errR, errW, err := pipe()
	if err != nil {
		return fail("pipe: %v", err)
	}

	var ole atomic.Bool
	var outTotal, errTotal int64
	var wg sync.WaitGroup
	wg.Add(2)
	go drain(outR, spec.StdoutFile, spec.OutputLimitBytes, spec.OutputLimitBytes > 0, func() {
		ole.Store(true)
		procTerminateJobObject.Call(job, 1)
	}, &outTotal, &wg)
	go drain(errR, spec.StderrFile, spec.StderrLimitBytes, false, nil, &errTotal, &wg)

	// Attribute list: AppContainer security capabilities + explicit inherited handle list.
	var size uintptr
	nattr := uintptr(2)
	if spec.NoContainer {
		nattr = 1
	}
	procInitializeProcThreadAttributeList.Call(0, nattr, 0, uintptr(unsafe.Pointer(&size)))
	attrBuf := make([]byte, size)
	attrList := uintptr(unsafe.Pointer(&attrBuf[0]))
	if r, _, e := procInitializeProcThreadAttributeList.Call(attrList, nattr, 0, uintptr(unsafe.Pointer(&size))); r == 0 {
		syscall.CloseHandle(outW)
		syscall.CloseHandle(errW)
		return fail("InitializeProcThreadAttributeList: %v", e)
	}
	defer procDeleteProcThreadAttributeList.Call(attrList)
	handles := []syscall.Handle{stdin, outW, errW}
	procUpdateProcThreadAttribute.Call(attrList, 0, procThreadAttributeHandleList,
		uintptr(unsafe.Pointer(&handles[0])), uintptr(len(handles))*unsafe.Sizeof(handles[0]), 0, 0)
	caps := securityCapabilities{AppContainerSid: sid}
	if !spec.NoContainer {
		if r, _, e := procUpdateProcThreadAttribute.Call(attrList, 0, procThreadAttributeSecurityCapabilities,
			uintptr(unsafe.Pointer(&caps)), unsafe.Sizeof(caps), 0, 0); r == 0 {
			syscall.CloseHandle(outW)
			syscall.CloseHandle(errW)
			return fail("UpdateProcThreadAttribute(security capabilities): %v", e)
		}
	}

	var si startupInfoEx
	si.Cb = uint32(unsafe.Sizeof(si))
	si.Flags = syscall.STARTF_USESTDHANDLES
	si.StdInput = stdin
	si.StdOutput = outW
	si.StdErr = errW
	si.AttributeList = attrList

	quoted := make([]string, len(spec.Args))
	for i, a := range spec.Args {
		quoted[i] = syscall.EscapeArg(a)
	}
	cmdline, _ := syscall.UTF16FromString(strings.Join(quoted, " "))
	var cwd *uint16
	if spec.Cwd != "" {
		cwd = utf16Ptr(spec.Cwd)
	}
	var pi syscall.ProcessInformation
	r, _, e := procCreateProcessW.Call(
		uintptr(unsafe.Pointer(utf16Ptr(spec.Args[0]))),
		uintptr(unsafe.Pointer(&cmdline[0])),
		0, 0, 1,
		extendedStartupinfoPresent|createSuspended|createUnicodeEnvironment|createNoWindow,
		uintptr(unsafe.Pointer(envBlock(spec.Env))),
		uintptr(unsafe.Pointer(cwd)),
		uintptr(unsafe.Pointer(&si)),
		uintptr(unsafe.Pointer(&pi)))
	syscall.CloseHandle(outW)
	syscall.CloseHandle(errW)
	if r == 0 {
		wg.Wait()
		return fail("CreateProcess %s: %v", spec.Args[0], e)
	}
	defer syscall.CloseHandle(pi.Process)
	defer syscall.CloseHandle(pi.Thread)
	if r, _, e := procAssignProcessToJobObject.Call(job, uintptr(pi.Process)); r == 0 {
		syscall.TerminateProcess(pi.Process, 1)
		wg.Wait()
		return fail("AssignProcessToJobObject: %v", e)
	}
	start := time.Now()
	procResumeThread.Call(uintptr(pi.Thread))

	var acct jobAccounting
	cpuMs := func() int64 {
		procQueryInformationJobObject.Call(job, jobObjectBasicAccountingInformation,
			uintptr(unsafe.Pointer(&acct)), unsafe.Sizeof(acct), 0)
		return (acct.TotalUserTime + acct.TotalKernelTime) / 10000
	}
	memExceeded, procExceeded, tle, wallExceeded := false, false, false, false
	pollPort := func() {
		for {
			var code uint32
			var key uintptr
			var ov uintptr
			r, _, _ := procGetQueuedCompletionStatus.Call(
				uintptr(port),
				uintptr(unsafe.Pointer(&code)),
				uintptr(unsafe.Pointer(&key)),
				uintptr(unsafe.Pointer(&ov)),
				0,
			)
			if r == 0 && ov == 0 {
				return
			}
			switch code {
			case jobMsgJobMemoryLimit, jobMsgProcessMemoryLimit:
				memExceeded = true
			case jobMsgActiveProcessLimit:
				procExceeded = true
			case jobMsgEndOfJobTime:
				tle = true
			}
		}
	}
	for {
		ev, _ := syscall.WaitForSingleObject(pi.Process, 5)
		pollPort()
		if ev == syscall.WAIT_OBJECT_0 {
			break
		}
		if spec.TimeLimitMs > 0 && cpuMs() > spec.TimeLimitMs {
			tle = true
			procTerminateJobObject.Call(job, 1)
		}
		if time.Since(start).Milliseconds() > spec.WallLimitMs {
			wallExceeded = true
			procTerminateJobObject.Call(job, 1)
		}
		if tle || wallExceeded || ole.Load() {
			syscall.WaitForSingleObject(pi.Process, 2000)
			break
		}
	}
	res.WallMs = time.Since(start).Milliseconds()
	var exit uint32
	syscall.GetExitCodeProcess(pi.Process, &exit)
	res.ExitCode = exit
	res.CpuMs = cpuMs()
	var ext jobExtendedLimit
	procQueryInformationJobObject.Call(job, jobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&ext)), unsafe.Sizeof(ext), 0)
	res.PeakMemoryBytes = int64(ext.PeakJobMemoryUsed)
	// Kill anything left behind (the whole tree lives in the job) and flush pipes.
	procTerminateJobObject.Call(job, 1)
	wg.Wait()
	pollPort()
	res.OutputBytes = atomic.LoadInt64(&outTotal)

	const statusNoMemory, statusCommitmentLimit = 0xC0000017, 0xC000012D
	switch {
	case ole.Load():
		res.Status, res.Detail = "OLE", fmt.Sprintf("output exceeded %d bytes", spec.OutputLimitBytes)
	case tle || (spec.TimeLimitMs > 0 && res.CpuMs > spec.TimeLimitMs):
		res.Status, res.Detail = "TLE", "CPU time limit exceeded"
	case wallExceeded:
		res.Status, res.Detail = "TLE", "wall-clock limit exceeded (idle or blocked)"
	case memExceeded || (spec.MemoryLimitBytes > 0 && res.PeakMemoryBytes > spec.MemoryLimitBytes) || ((exit == statusNoMemory || exit == statusCommitmentLimit) && spec.MemoryLimitBytes > 0):
		res.Status, res.Detail = "MLE", "memory limit exceeded"
	case procExceeded:
		res.Status, res.Detail = "RE", "attempted to create a process"
	case exit != 0:
		res.Status, res.Detail = "RE", describeExit(exit)
	default:
		res.Status = "OK"
	}
	return res
}

func describeExit(code uint32) string {
	switch code {
	case 0xC0000005:
		return "access violation (0xC0000005)"
	case 0xC00000FD:
		return "stack overflow (0xC00000FD)"
	case 0xC0000094:
		return "integer division by zero (0xC0000094)"
	case 0xC0000409:
		return "stack buffer overrun / fast fail (0xC0000409)"
	case 0xC000001D:
		return "illegal instruction (0xC000001D)"
	case 0xC0000135:
		return "missing DLL (0xC0000135)"
	case 3:
		return "abort() called (exit code 3)"
	}
	if code >= 0xC0000000 {
		return fmt.Sprintf("exception 0x%08X", code)
	}
	return fmt.Sprintf("exit code %d", code)
}
