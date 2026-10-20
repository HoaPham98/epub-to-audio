# audio-streaming Specification

## Purpose

Enables low-latency real-time audio playback using Web Audio API streaming from VieNeu-TTS via Server-Sent Events (SSE) with lead-in pre-buffering, gapless chunk transitions, and immediate server slot cancellation.

## Requirements

### Requirement: Low-Latency SSE Audio Streaming
The system SHALL ingest audio chunks streamed via Server-Sent Events (SSE) from the TTS endpoint (`POST /v1/audio/speech` with `stream_format=sse` and `response_format=pcm`) and dispatch audio deltas immediately to the playback pipeline, without enforcing low character limits (`max_chars`) that cause server-side phoneme re-segmentation and repetition.

#### Scenario: Successful SSE stream ingestion
- **WHEN** the user initiates playback for a text chunk
- **THEN** the system sends a request with `stream_format=sse` and `response_format=pcm`
- **AND** processes each `speech.audio.delta` base64 payload as it arrives

#### Scenario: Stream completion
- **WHEN** the server sends `speech.audio.done`
- **THEN** the system marks the streaming phase complete and triggers cache persistence

#### Scenario: Prevention of redundant server-side chunk splitting
- **WHEN** a client-side chunk is dispatched for streaming synthesis
- **THEN** the client does NOT pass a restrictive `max_chars` threshold (e.g. 200) in the request body
- **AND** the server relies on the client's semantic chunk boundaries without splitting phonemized text mid-sentence or repeating phrases

### Requirement: Pre-Buffered Web Audio Playback
The system SHALL use Web Audio API (`AudioContext`) with a configurable 150–300ms lead-in buffer (300ms for CPU backends) to schedule PCM s16le audio playback smoothly without network jitter stalls, and support non-destructive suspend/resume state on pause with a strict audio output suspension lock.

#### Scenario: Starting playback after lead-in buffer
- **WHEN** incoming streamed PCM audio reaches the lead-in buffer threshold (150–300ms)
- **THEN** playback starts immediately through AudioContext before the rest of the stream finishes

#### Scenario: Graceful re-buffering on buffer underrun
- **WHEN** the audio queue becomes empty before the next chunk buffer arrives
- **THEN** the system pauses audio output cleanly without pops or crackles and resumes once 300ms lead-in buffer is refilled

#### Scenario: Suspending and resuming audio on pause
- **WHEN** the user pauses playback while audio is actively playing or streaming
- **THEN** the system calls `AudioContext.suspend()` to freeze audio output while preserving scheduled nodes in memory
- **AND** when the user unpauses, the system calls `AudioContext.resume()` to immediately continue playback from the exact paused millisecond without re-fetching

#### Scenario: Background pre-buffering while paused
- **WHEN** playback is paused while a chunk stream is in progress or subsequent chunks are being pre-buffered
- **THEN** the system continues sequentially receiving and queueing streamed audio deltas for upcoming chunks until the total buffered text length reaches the target prefetch threshold (800–1,200 characters)
- **AND** once the threshold is satisfied, the system stops prefetching to conserve network bandwidth and API quota
- **AND** the system strictly maintains `AudioContext` in suspended state so that background buffers never produce unexpected audible sound

### Requirement: Strict Sequential Chaining for Single-Stream Endpoints
The system SHALL support strict sequential chaining for CPU-only backends with `max_streams=1`, initiating the stream for subsequent chunks sequentially whenever the forward buffer depth is below the target window, ensuring exactly $\le 1$ active network request at all times.

#### Scenario: Immediate chaining of next chunk stream
- **WHEN** a chunk stream completes receiving `speech.audio.done` from the server
- **AND** the total unplayed buffered text ahead of the playhead is less than the prefetch threshold (800–1,200 characters)
- **THEN** the system immediately starts streaming the next sequential chunk and appends its audio buffers to the active timeline

#### Scenario: Single active network stream guarantee
- **WHEN** a chunk is actively streaming from the server
- **THEN** no other prefetch or background requests are initiated until the current stream closes

### Requirement: Timeline-Based Reader Highlighting Synchronization
The system SHALL track timeline boundaries `{ chapterIndex, chunkIndex, startTime, endTime }` for all scheduled chunks in the audio player and notify presentation components as playback transitions across chunk boundaries, isolating viewport auto-scrolling to chunk index changes while suppressing scroll events during playback state toggles.

#### Scenario: Chunk boundary transition
- **WHEN** the current playback time crosses the start time of the next scheduled chunk
- **THEN** the system fires an `onChunkChange` event
- **AND** the Reader component updates active highlight and scrolls into view without interrupting audio playback

#### Scenario: Play and pause state toggles suppress viewport scroll
- **WHEN** the user toggles play or pause state via the UI, MediaSession, or hardware controls without changing the active chunk
- **THEN** the reader updates playback state indicators without executing any viewport scroll animation

#### Scenario: Background chunk transition suppresses auto-scroll
- **WHEN** audio playback transitions chunk boundaries while the tab is hidden or backgrounded
- **THEN** the reader updates active chunk indexes without executing `scrollIntoView`

### Requirement: Immediate Stream Cancellation on User Action
The system SHALL abort in-flight TTS streaming requests and halt active playback nodes when the user seeks or jumps to another chunk or chapter, while preserving in-flight streams on pause and toggling pause/resume when interacting with the active chunk.

#### Scenario: User pauses during streaming
- **WHEN** playback is paused while a TTS stream is active
- **THEN** the system suspends audio output but keeps the network stream active to buffer ahead

#### Scenario: User clicks active playing chunk in Reader
- **WHEN** the user clicks the action button of the chunk currently being played
- **THEN** the system pauses playback without aborting or restarting the active stream

#### Scenario: User clicks active paused chunk in Reader
- **WHEN** the user clicks the action button of the active chunk while paused
- **THEN** the system resumes playback from the exact paused position

#### Scenario: User skips to a different chunk
- **WHEN** the user clicks on a different chunk or navigates to another chapter while streaming
- **THEN** the previous stream is cancelled immediately via AbortSignal to release the TTS server slot and the new chunk stream begins

### Requirement: Streaming Proxy Passthrough
The local API proxy (`/api/tts-proxy`) SHALL stream data chunks directly to the client via `ReadableStream` without buffering the entire response in server memory, and forward request abort signals upstream.

#### Scenario: Proxying SSE stream without buffering
- **WHEN** a client sends a streaming TTS request via `/api/tts-proxy`
- **THEN** the proxy passes the upstream response body as a real-time stream with matching content type headers

#### Scenario: Upstream abort signal forwarding
- **WHEN** a client aborts the proxy HTTP connection
- **THEN** the proxy immediately aborts the upstream fetch request to terminate server-side generation

### Requirement: Audio Cache Persistence
The system SHALL collect received PCM audio deltas into a complete audio file in IndexedDB once streaming completes, allowing instantaneous replay without network requests.

#### Scenario: Replaying a previously cached chunk
- **WHEN** playback is requested for a chunk already present in the IndexedDB cache
- **THEN** the system plays the cached audio immediately without contacting the TTS server

### Requirement: Server Busy and HTTP 429 Resilience
The system SHALL intercept HTTP 429 (Too Many Requests) and server busy responses, executing automatic exponential backoff retries without crashing or requiring application reload.

#### Scenario: Automatic retry on HTTP 429 response
- **WHEN** the TTS endpoint returns HTTP 429
- **THEN** the client waits for the delay specified in `Retry-After` (or exponential backoff intervals of 1s, 2s, 4s) and retries the request up to 3 times
- **AND** displays an informative status message to the user during the retry interval

#### Scenario: Recovery after retries exhausted
- **WHEN** all automatic retries fail
- **THEN** the system displays a clear error message with a manual "Thử lại" action button that restarts the stream without requiring a full page refresh

### Requirement: First-Packet Ready State and Contextual Chunk Playback Controls
The system SHALL transition the playback state machine from connecting to playing as soon as the first playable audio packet arrives, immediately unlocking user pause controls, and SHALL render contextual action labels on chunk items.

#### Scenario: Unlocking pause control upon first packet arrival
- **WHEN** audio streaming initiates and the first audio delta (~300ms lead-in) is decoded and queued
- **THEN** the system sets `isLoading = false` and `isPlaying = true`
- **AND** enables the Pause button in the audio player bar immediately without waiting for stream completion

#### Scenario: Contextual action labels on Reader chunks
- **WHEN** a chunk is currently playing
- **THEN** its action button displays `Tạm dừng`
- **AND** when the active chunk is paused, its action button displays `Tiếp tục`
- **AND** while a subsequent chunk is pre-buffering in background, it displays an isolated pre-buffering indicator `Đang nạp sẵn...` without marking the paused chunk as buffering

### Requirement: Scrubber and Speech Duration Buffer Estimation
The system SHALL present playback progress and buffer depth relative to the active chapter duration, estimating total chapter duration from chunk character counts (~16 chars/second) and dynamically refining as chunks decode.

#### Scenario: Visual buffer bar progression during stream reception
- **WHEN** audio packets arrive or chunks are prefetched into the active chapter queue
- **THEN** the scrubber bar displays a buffered range overlay proportional to `chapterBufferedTime / chapterTotalDuration`
- **AND** displays an informative status badge `Đệm trước: +Xs` indicating forward buffer seconds ahead of current playback position

#### Scenario: Snapping to exact duration on stream completion
- **WHEN** a chunk finishes decoding or streaming
- **THEN** the system updates the chapter duration table with the exact decoded audio length, refining total chapter duration without jitter

### Requirement: Token-Based Sliding Window Prefetch Evaluation
The system SHALL calculate remaining unplayed text length in the forward buffer and trigger prefetching whenever unplayed buffered characters drop below the minimum threshold (800–1,200 characters).

#### Scenario: Maintaining forward buffer during playback
- **WHEN** audio playback advances and unplayed text in the forward buffer falls below 800 characters
- **AND** no TTS network stream is currently active
- **THEN** the system automatically dispatches a prefetch request for the next chunk to maintain continuous playback

#### Scenario: Throttling prefetch when safe threshold is met
- **WHEN** unplayed text in the forward audio buffer reaches or exceeds 1,200 characters
- **THEN** the system suspends further prefetch requests until playback drains the buffer below the minimum threshold

### Requirement: Cross-Chapter Prefetch Continuity
The system SHALL allow the prefetch sliding window to cross chapter boundaries when `autoNext` is enabled and remaining text in the active chapter is insufficient to satisfy the buffer threshold.

#### Scenario: Seamless prefetching across chapter boundaries
- **WHEN** the active chapter has fewer than 800 unplayed characters remaining across all its pending chunks
- **AND** `autoNext` is enabled and a subsequent chapter exists
- **THEN** the prefetch evaluator chains into chunk 0 of the next chapter without interrupting current audio playback

#### Scenario: Halting at chapter end when autoNext is disabled
- **WHEN** the active chapter ends and `autoNext` is disabled
- **THEN** the system does not prefetch into the next chapter and stops once the current chapter's chunks are fully queued

### Requirement: Chapter-Scoped Scrubbing and Playhead Mapping
The system SHALL map scrubber seek actions across the entire active chapter, jumping playback to the corresponding chunk and synchronizing Reader highlighting.

#### Scenario: User seeks across chapter timeline
- **WHEN** the user drags or clicks on the chapter scrubber bar at timestamp $T$
- **THEN** the system calculates which chunk in the chapter contains timestamp $T$
- **AND** jumps playback to that chunk, scrolling the Reader view to the active text position
- **AND** cancels any stale prefetch streams to begin streaming fresh from the target chunk

#### Scenario: Chapter transition resets timeline
- **WHEN** playback naturally completes the final chunk of a chapter and transitions to the next chapter
- **THEN** the chapter scrubber resets its timeline to `00:00` spanning the duration of the new chapter

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification, keeping the background audio bridge active via gain-level muting during pause to prevent notification shade dismissal, and supporting responsive notification playback control.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** mutes audio output via the audio graph gain node without suspending the MediaStream or tearing down the audio element
- **AND** updates the application playback state `isPlaying` to `false`

#### Scenario: User resumes playback from Android notification shade
- **WHEN** the user taps the play action on the Android notification or lockscreen controls while paused
- **THEN** the system sets `navigator.mediaSession.playbackState = 'playing'`
- **AND** restores audio output volume and validates that scheduled audio buffers are valid
- **AND** if buffered audio nodes expired during the pause duration, seamlessly re-streams from the active playback position without stalling

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession

#### Scenario: Persistent notification shade across media control interactions
- **WHEN** the user taps any media control button (play, pause, rewind 10s, fast-forward 10s, prev track, next track) on the notification shade
- **THEN** the system executes the requested action without causing the MediaStream to terminate or the notification drawer to auto-close
- **AND** the Android notification shade remains expanded for subsequent user interactions

#### Scenario: Focused 3-button audiobook notification layout
- **WHEN** the media session notification is displayed on Android
- **THEN** it exposes rewind 10s (`seekbackward`), play/pause (`play`, `pause`), and fast-forward 10s (`seekforward`), plus timeline scrubbing (`seekto`) and track skip handlers (`previoustrack`, `nexttrack`)
- **AND** routes media hardware actions to their corresponding player navigation controls

#### Scenario: MediaSession action handler mapping for navigation and seeking
- **WHEN** the media session notification is displayed on Android or desktop
- **THEN** it exposes seek backward (`seekbackward`), seek forward (`seekforward`), play/pause (`play`, `pause`), timeline scrubbing (`seekto`), and chunk navigation (`previoustrack`, `nexttrack`)
- **AND** each registered handler routes to the corresponding audio streamer navigation routine

#### Scenario: Full media session action handlers for OS shortcuts and hardware media keys
- **WHEN** the media session initializes
- **THEN** the system registers action handlers for `play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, and `seekto`
- **AND** hardware media keys (Play/Pause, Previous Track, Next Track) and Windows SMTC / macOS / mobile OS controls map directly to chunk navigation and audio playback controls

#### Scenario: Throttled MediaSession position synchronization
- **WHEN** the Web Audio player ticks high-frequency playback time updates (50ms)
- **THEN** `navigator.mediaSession.setPositionState` dispatches are throttled to a minimum interval of 500ms
- **AND** full position state is synchronized immediately upon explicit user seek or chunk change

### Requirement: iOS and Multiplatform Background Audio Continuity
The system SHALL maintain active OS media session continuity and background audio playback across desktop and mobile platforms, using an HTML5 audio element bridge that represents the actual speech playback state and remains available for system media controls while paused.

#### Scenario: iOS background playback on device lock
- **WHEN** audio playback is actively progressing and the user locks the mobile device (e.g. iOS Safari) or minimizes the browser
- **THEN** audio playback continues through the audio element bridge without suspension
- **AND** the system does not prematurely cancel or pause the playback queue

#### Scenario: AudioSession playback mode configuration
- **WHEN** the audio player initializes on a platform supporting W3C AudioSession (`navigator.audioSession`)
- **THEN** the system sets `navigator.audioSession.type = 'playback'`
- **AND** playback is not interrupted by physical silent/mute switches

#### Scenario: Real media stream binding replaces dummy silence bridge
- **WHEN** a platform spike confirms that a MediaStream-backed audio element can retain system media controls and accurately represent speech state
- **THEN** the system routes speech audio through that media element bridge
- **AND** does not use a separately playing silent loop to represent speech playback

#### Scenario: Silent audio loop bridge with immediate user gesture unlock
- **WHEN** a platform requires a silent audio loop bridge to establish system media controls
- **THEN** the system starts the bridge during the initial user gesture
- **AND** its reported playback state is synchronized with confirmed speech playback

#### Scenario: Silent audio bridge retention on pause
- **WHEN** the silent audio loop is the selected supported bridge and speech playback is paused
- **THEN** the bridge lifecycle preserves an available paused media session with a Play action
- **AND** the notification reports paused rather than playing

#### Scenario: Media bridge follows confirmed speech state
- **WHEN** speech playback is paused or resumed
- **THEN** the HTML audio bridge and Media Session report the confirmed speech playback state
- **AND** the paused media session remains available with a Play action
- **AND** the chosen bridge lifecycle is verified on Windows Chrome and Android Chrome

#### Scenario: Bridge paused on explicit stop
- **WHEN** playback is explicitly stopped or reset by the reader
- **THEN** the HTML5 audio element bridge is paused and the media session is released

### Requirement: Notification Playback State Follows Confirmed Speech Output
The system SHALL keep the reader and native media notification aligned with confirmed speech playback state, independently of TTS network streaming or prefetch activity.

#### Scenario: Pausing while TTS data continues to arrive
- **WHEN** speech playback is paused while a TTS request or prefetch is still receiving audio data
- **THEN** the reader and media notification remain in the paused state
- **AND** incoming data does not change playback state to playing

#### Scenario: Paused notification remains resumable
- **WHEN** speech playback is paused from the reader or a system media control
- **THEN** the media notification shows the paused state and provides a Play action while the media session remains available

#### Scenario: Successful resume from a media control
- **WHEN** the user requests Play from a notification or hardware media control
- **AND** speech audio output resumes successfully
- **THEN** the reader and media notification report playing
- **AND** the notification does not report playing before output has resumed

#### Scenario: Resume fails
- **WHEN** the user requests Play but audio output cannot resume
- **THEN** the reader and media notification remain paused
- **AND** the reader presents a recoverable playback error

#### Scenario: Playback is interrupted externally
- **WHEN** the browser or operating system suspends speech output while playback is reported as playing
- **THEN** the reader and media notification transition to paused

### Requirement: Screen-Off Background Audio Playback via HTMLMediaElement Bridge
The system SHALL route Web Audio API (`AudioContext`) output to a `MediaStreamAudioDestinationNode` connected to an HTML `<audio>` element (`srcObject = destination.stream`), keeping the OS background audio session alive when the screen is turned off or when the application is placed in the background on mobile and desktop browsers.

#### Scenario: Continuous background playback when device screen locks
- **WHEN** audio is actively playing or streaming a book chunk
- **AND** the user locks the mobile device or switches to another application
- **THEN** audio continues playing seamlessly through the bridged HTML `<audio>` element without stopping or stuttering
- **AND** the system continues receiving and scheduling sequential audio chunks over the network.

#### Scenario: Audio pipeline initialization on user gesture
- **WHEN** the user initiates playback for the first time
- **THEN** both the `AudioContext` and the bridged HTML `<audio>` element are unlocked simultaneously within the user gesture handler
- **AND** the `<audio>` element plays silence or the piped media stream without throwing autoplay errors.

### Requirement: Media Session API Integration for System Notification and Lock Screen Controls
The system SHALL synchronize playback state, track metadata, and hardware/notification controls via `navigator.mediaSession`, allowing the user to view track information and control playback from the system notification shade and lock screen.

#### Scenario: Displaying rich book and chunk metadata
- **WHEN** audio playback starts or transitions to chunk $Y$ of chapter $X$ in book $B$
- **THEN** the system sets `navigator.mediaSession.metadata` with:
  - `title`: `[Tên chương] - Đoạn Y/TotalChunks`
  - `artist`: `[Tên tác giả]`
  - `album`: `[Tên sách]`
  - `artwork`: The book cover URL (if present) and fallback high-resolution application icons.

#### Scenario: Controlling playback via notification Play/Pause action
- **WHEN** the user triggers the `play` or `pause` action on the system notification or lock screen
- **THEN** the system toggles `AudioPlayer` state between playing and paused
- **AND** updates `navigator.mediaSession.playbackState` to reflect `'playing'` or `'paused'`.

#### Scenario: Navigating chunks via notification Next/Previous Track action
- **WHEN** the user triggers `nexttrack` from the lock screen or notification
- **THEN** the system advances to chunk $Y+1$ (or chunk 0 of chapter $X+1$ if at the end of the chapter)
- **AND** when the user triggers `previoustrack`, the system navigates to chunk $Y-1$ (or the previous chapter if at the start).

#### Scenario: Relative seeking via notification Seek Backward/Forward action
- **WHEN** the user triggers `seekbackward` or `seekforward` with an offset (defaulting to 10 seconds)
- **THEN** the player adjusts playback position backward or forward by the specified amount
- **AND** updates `navigator.mediaSession.setPositionState` with the new position and duration.

### Requirement: Audio Interruption and Audio Focus Handling
The system SHALL automatically respond to external audio interruptions and device audio route changes, pausing audio cleanly when headphones or Bluetooth devices disconnect.

#### Scenario: Headphone or Bluetooth disconnection
- **WHEN** audio is playing and the output audio device is disconnected (headphone unplugged or Bluetooth turned off)
- **THEN** the system pauses audio playback automatically
- **AND** updates the UI and notification state to paused to prevent sudden loudspeaker playback.

#### Scenario: Audio focus loss due to incoming call
- **WHEN** the operating system interrupts the audio session (e.g. incoming call or another media app starts)
- **THEN** the bridged `<audio>` element receives the pause/interruption event
- **AND** the system transitions to paused state, preserving the exact resume position.

### Requirement: Natural Silence Padding Between Audio Chunks
The system SHALL insert configurable silence padding when scheduling and concatenating audio chunks in the Web Audio stream player, applying 250ms–300ms pause between sentence-level chunks and 400ms–600ms pause between paragraph breaks.

#### Scenario: Inter-sentence silence padding
- **WHEN** subsequent sentence-level chunks within the same paragraph are scheduled for playback
- **THEN** the audio player schedules a 250ms–300ms silence gap between the end of the previous chunk and the start of the next chunk

#### Scenario: Paragraph boundary silence padding
- **WHEN** subsequent chunks cross a paragraph break
- **THEN** the audio player schedules a 400ms–600ms silence gap to provide a natural cadence break
