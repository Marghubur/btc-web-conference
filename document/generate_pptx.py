import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# ── Color Palette ─────────────────────────────────────────────────────────────
BG_DARK = RGBColor(7, 9, 14)          # #07090E
BG_CARD = RGBColor(18, 24, 38)        # #121826
BORDER_CYAN = RGBColor(0, 242, 254)   # #00F2FE
BORDER_SUBTLE = RGBColor(40, 50, 70)  # Subtle border

TEXT_WHITE = RGBColor(255, 255, 255)
TEXT_CYAN = RGBColor(0, 242, 254)     # #00F2FE
TEXT_BLUE = RGBColor(79, 172, 254)    # #4FACFE
TEXT_PURPLE = RGBColor(192, 132, 252) # #C084FC
TEXT_EMERALD = RGBColor(16, 185, 129) # #10B981
TEXT_PINK = RGBColor(255, 0, 128)     # #FF0080
TEXT_GRAY = RGBColor(148, 163, 184)   # #94A3B8
TEXT_MUTED = RGBColor(100, 116, 139)  # #64748B

BASE_DIR = r"c:\ws\bottomhalf\confeet\btc-web-conference\document"
CHARTS_DIR = os.path.join(BASE_DIR, "charts")
LOGO_PATH = os.path.join(BASE_DIR, "logos.png")
HERO_IMG_PATH = os.path.join(BASE_DIR, "confeet_executive_hero.jpg")
OUTPUT_PATH = os.path.join(BASE_DIR, "CONFEET_EXECUTIVE_PRESENTATION.pptx")

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

def set_slide_background(slide):
    bg_shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg_shape.fill.solid()
    bg_shape.fill.fore_color.rgb = BG_DARK
    bg_shape.line.fill.background()
    return bg_shape

def add_header(slide, tag_text, title_text, subtitle_text=""):
    tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8), Inches(0.35))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = tag_text.upper()
    p_tag.font.name = "Arial"
    p_tag.font.size = Pt(9.5)
    p_tag.font.bold = True
    p_tag.font.color.rgb = TEXT_CYAN

    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(9.5), Inches(0.65))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    p_title.text = title_text
    p_title.font.name = "Arial"
    p_title.font.size = Pt(23)
    p_title.font.bold = True
    p_title.font.color.rgb = TEXT_WHITE

    if subtitle_text:
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.32), Inches(10), Inches(0.38))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.name = "Arial"
        p_sub.font.size = Pt(11.5)
        p_sub.font.color.rgb = TEXT_GRAY

    if os.path.exists(LOGO_PATH):
        try:
            slide.shapes.add_picture(LOGO_PATH, Inches(11.2), Inches(0.45), width=Inches(1.3))
        except Exception:
            pass

def add_footer(slide, current_idx, total_slides=10, footer_note="Confeet Enterprise Real-Time Platform"):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.8), Inches(11.733), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = BORDER_SUBTLE
    line.line.fill.background()

    note_box = slide.shapes.add_textbox(Inches(0.8), Inches(6.88), Inches(8), Inches(0.35))
    tf_note = note_box.text_frame
    p_note = tf_note.paragraphs[0]
    p_note.text = f"● PRODUCTION ARCHITECTURE  |  {footer_note}"
    p_note.font.name = "Arial"
    p_note.font.size = Pt(9)
    p_note.font.color.rgb = TEXT_MUTED

    page_box = slide.shapes.add_textbox(Inches(10.8), Inches(6.88), Inches(1.733), Inches(0.35))
    tf_page = page_box.text_frame
    p_page = tf_page.paragraphs[0]
    p_page.text = f"{current_idx:02d} / {total_slides:02d}"
    p_page.alignment = PP_ALIGN.RIGHT
    p_page.font.name = "Arial"
    p_page.font.size = Pt(10)
    p_page.font.bold = True
    p_page.font.color.rgb = TEXT_CYAN

def add_bullets_card(slide, left, top, width, height, title, bullet_items, top_color=BORDER_CYAN):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = BG_CARD
    card.line.color.rgb = BORDER_SUBTLE
    card.line.width = Pt(1)

    if top_color:
        bar = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, Inches(0.05))
        bar.fill.solid()
        bar.fill.fore_color.rgb = top_color
        bar.line.fill.background()

    tb = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.25), width - Inches(0.5), height - Inches(0.5))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = title
    p0.font.name = "Arial"
    p0.font.size = Pt(14)
    p0.font.bold = True
    p0.font.color.rgb = TEXT_WHITE
    p0.space_after = Pt(12)

    for item in bullet_items:
        p = tf.add_paragraph()
        p.text = f"•  {item}"
        p.font.name = "Arial"
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_GRAY
        p.space_after = Pt(10)
        p.line_spacing = 1.25

    return card

def add_image_card(slide, left, top, width, height, img_path):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = BG_CARD
    card.line.color.rgb = BORDER_SUBTLE
    card.line.width = Pt(1)

    if os.path.exists(img_path):
        try:
            # Fit inside card nicely
            pad = Inches(0.12)
            slide.shapes.add_picture(img_path, left + pad, top + pad, width=width - (pad*2), height=height - (pad*2))
        except Exception as e:
            print(f"Error adding picture {img_path}: {e}")

def set_speaker_notes(slide, notes_text):
    notes_slide = slide.notes_slide
    text_frame = notes_slide.notes_text_frame
    text_frame.text = notes_text

# ==============================================================================
# SLIDE 1: Title & Executive Vision
# ==============================================================================
s1 = prs.slides.add_slide(blank_layout)
set_slide_background(s1)
add_header(s1, "Executive Keynote 2026", "Confeet: Next-Gen Enterprise Communication")

left_tb = s1.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(6.0), Inches(3.2))
tf = left_tb.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
p.text = "Unified Real-Time Chat &\nLiveKit SFU Video Conferencing"
p.font.name = "Arial"
p.font.size = Pt(25)
p.font.bold = True
p.font.color.rgb = TEXT_WHITE
p.space_after = Pt(14)

p2 = tf.add_paragraph()
p2.text = (
    "A single cloud-native ecosystem engineered to eliminate SaaS vendor sprawl, "
    "drastically cut bandwidth costs, and provide enterprise data sovereignty with sub-millisecond responsiveness."
)
p2.font.name = "Arial"
p2.font.size = Pt(12)
p2.font.color.rgb = TEXT_GRAY
p2.line_spacing = 1.3

# Metric cards
metrics = [
    ("< 50ms", "Chat Delivery Latency"),
    ("90%", "Bandwidth Saved (SFU)"),
    ("70%", "Estimated TCO Savings")
]
for idx, (m_val, m_lbl) in enumerate(metrics):
    m_left = Inches(0.8 + idx * 2.05)
    card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, m_left, Inches(5.1), Inches(1.9), Inches(1.35))
    card.fill.solid()
    card.fill.fore_color.rgb = BG_CARD
    card.line.color.rgb = BORDER_SUBTLE
    
    tb = s1.shapes.add_textbox(m_left + Inches(0.1), Inches(5.2), Inches(1.7), Inches(1.1))
    tf = tb.text_frame
    p_num = tf.paragraphs[0]
    p_num.text = m_val
    p_num.font.name = "Arial"
    p_num.font.size = Pt(19)
    p_num.font.bold = True
    p_num.font.color.rgb = TEXT_CYAN
    
    p_l = tf.add_paragraph()
    p_l.text = m_lbl
    p_l.font.name = "Arial"
    p_l.font.size = Pt(8.5)
    p_l.font.color.rgb = TEXT_GRAY

if os.path.exists(HERO_IMG_PATH):
    try:
        s1.shapes.add_picture(HERO_IMG_PATH, Inches(7.1), Inches(1.8), width=Inches(5.43), height=Inches(4.65))
    except Exception:
        pass

add_footer(s1, 1, 10, "Executive Vision & Platform Architecture")
set_speaker_notes(s1, "Welcome CEOs and CTOs. Today I present Confeet — an enterprise collaboration platform uniting high-concurrency instant messaging, LiveKit SFU video conferencing, and smart presence to solve bandwidth and cost issues natively.")


# ==============================================================================
# SLIDE 2: The Scaling Bottleneck (Mesh vs SFU Graph)
# ==============================================================================
s2 = prs.slides.add_slide(blank_layout)
set_slide_background(s2)
add_header(s2, "The Enterprise Bottleneck", "Why Traditional Video Stacks Fail at Scale", "Legacy P2P Mesh creates severe bandwidth saturation as participant count increases.")

add_bullets_card(
    s2, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Core Enterprise Pain Points",
    [
        "Quadratic Bandwidth Explosion: Legacy P2P WebRTC requires every participant to upload streams to all others (O(N²)).",
        "Device Overheating & Frame Drops: Beyond 4 participants, laptops throttle CPU and video packet loss spikes above 45%.",
        "Confeet Solution: LiveKit SFU limits each user to exactly 1 upload stream, saving 90% bandwidth at 10+ participants.",
        "Zero Client Bottleneck: Easily scales to 100+ active participants per room."
    ],
    BORDER_CYAN
)

add_image_card(
    s2, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7),
    os.path.join(CHARTS_DIR, "chart_bandwidth_scaling.png")
)

add_footer(s2, 2, 10, "Bandwidth Scalability Advantage")
set_speaker_notes(s2, "As you can see in the graph, P2P WebRTC bandwidth scales quadratically (O(N^2)). By 10 participants, client uplink is completely overwhelmed. Confeet's LiveKit SFU keeps client uplink flat at 2.0 Mbps regardless of room size.")


# ==============================================================================
# SLIDE 3: Four Pillars of Confeet Suite
# ==============================================================================
s3 = prs.slides.add_slide(blank_layout)
set_slide_background(s3)
add_header(s3, "Product Suite", "Four Core Pillars in One Unified Platform", "All enterprise collaboration essentials converged into a seamless, high-performance experience.")

card_w4 = Inches(2.72)
card_h4 = Inches(4.7)

add_bullets_card(
    s3, Inches(0.8), Inches(1.85), card_w4, card_h4,
    "💬 1. Instant Messaging",
    [
        "1:1 & Group channels",
        "Read & delivery receipts",
        "Monotonic FIFO ordering",
        "Rich media attachments",
        "Multi-device instant sync"
    ],
    BORDER_CYAN
)
add_bullets_card(
    s3, Inches(3.78), Inches(1.85), card_w4, card_h4,
    "📹 2. LiveKit SFU Video",
    [
        "Adaptive video simulcast",
        "Dynacast bandwidth saver",
        "AI background blur",
        "HD screen sharing (1080p)",
        "Active speaker priority"
    ],
    TEXT_PINK
)
add_bullets_card(
    s3, Inches(6.76), Inches(1.85), card_w4, card_h4,
    "🟢 3. Smart Presence",
    [
        "Sub-millisecond status",
        "Active call ring dispatch",
        "120s auto call timeouts",
        "Zero broadcast storm",
        "Dynamic gateway mapping"
    ],
    TEXT_EMERALD
)
add_bullets_card(
    s3, Inches(9.74), Inches(1.85), card_w4, card_h4,
    "🔔 4. Contextual Push",
    [
        "Presence suppression",
        "APNs & FCM mobile alerts",
        "Zero duplicate spam",
        "Background task workers",
        "Seamless offline recovery"
    ],
    TEXT_PURPLE
)

add_footer(s3, 3, 10, "Unified Angular 18 + SignalStore Architecture")
set_speaker_notes(s3, "Confeet replaces 3 separate enterprise tools with one platform: instant messaging, video meetings via LiveKit, instant user presence, and contextual mobile push notifications.")


# ==============================================================================
# SLIDE 4: Architecture & End-to-End Latency Benchmark
# ==============================================================================
s4 = prs.slides.add_slide(blank_layout)
set_slide_background(s4)
add_header(s4, "Engineering Advantage", "Dual-Ingress Architecture & Global Latency", "Decoupling synchronous gRPC writes, durable Kafka logs, and sub-millisecond NATS pub/sub.")

add_bullets_card(
    s4, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Architectural Highlights",
    [
        "Dual-Ingress Separation: High-speed WebSocket Gateway for chat/signaling + Dedicated LiveKit SFU for WebRTC media.",
        "Synchronous gRPC Core: Instant message validation and sequence allocation before acknowledgment.",
        "Kafka + NATS Synergy: Kafka ensures permanent durable storage, while NATS JetStream achieves sub-millisecond fan-out.",
        "Measurable Latency Win: Confeet chat delivers in 28ms, beating standard HTTP REST and WebSocket broadcasts by over 80%."
    ],
    BORDER_CYAN
)

add_image_card(
    s4, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7),
    os.path.join(CHARTS_DIR, "chart_latency_benchmark.png")
)

add_footer(s4, 4, 10, "Sub-50ms Message Delivery Globally")
set_speaker_notes(s4, "Notice our latency benchmark on the right: Traditional WebSocket broadcast takes 320ms. Confeet's gRPC + NATS pipeline delivers messages in just 28ms, providing a crisp, instantaneous experience.")


# ==============================================================================
# SLIDE 5: LiveKit SFU Video Conferencing Performance
# ==============================================================================
s5 = prs.slides.add_slide(blank_layout)
set_slide_background(s5)
add_header(s5, "Video Infrastructure", "LiveKit SFU: Carrier-Grade Conferencing", "Selective Forwarding Unit with intelligent track distribution and client AI.")

add_bullets_card(
    s5, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Next-Gen Video Capabilities",
    [
        "Simulcast Video Encoding: Automatically generates 1080p, 720p, and 360p layers; receivers get only the layer their screen requires.",
        "Dynacast Bandwidth Throttling: Pauses off-screen video tracks completely, drastically saving device CPU and battery.",
        "Edge AI Background Segmentation: Client-side TensorFlow.js blur and virtual backgrounds with zero server GPU overhead.",
        "Unified CameraService: Smooth device switching, diagnostics telemetry, and screen sharing without call interruption."
    ],
    TEXT_PINK
)

# Right: Feature Box + Metrics
right_card = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7))
right_card.fill.solid()
right_card.fill.fore_color.rgb = BG_CARD
right_card.line.color.rgb = BORDER_SUBTLE

tb = s5.shapes.add_textbox(Inches(7.1), Inches(2.1), Inches(5.133), Inches(4.2))
tf = tb.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
p.text = "SFU Performance Metrics"
p.font.name = "Arial"
p.font.size = Pt(16)
p.font.bold = True
p.font.color.rgb = TEXT_CYAN
p.space_after = Pt(14)

kpis = [
    ("< 180ms", "Glass-to-Glass Video Latency", TEXT_EMERALD),
    ("100+ Users", "Concurrent Participants / Room", TEXT_CYAN),
    ("1080p 60fps", "Crystal Clear Screen Sharing", TEXT_PURPLE),
    ("Zero", "Server Transcoding GPU Cost", TEXT_PINK)
]

for num, label, color in kpis:
    pn = tf.add_paragraph()
    pn.text = num
    pn.font.name = "Arial"
    pn.font.size = Pt(18)
    pn.font.bold = True
    pn.font.color.rgb = color
    pn.space_before = Pt(8)

    pl = tf.add_paragraph()
    pl.text = label.upper()
    pl.font.name = "Arial"
    pl.font.size = Pt(9)
    pl.font.color.rgb = TEXT_GRAY

add_footer(s5, 5, 10, "LiveKit WebRTC SFU • Simulcast & Dynacast")
set_speaker_notes(s5, "Our LiveKit SFU video implementation offers crystal clear 1080p video, sub-180ms glass-to-glass latency, and client-side AI background segmentation without expensive server-side GPU transcoding.")


# ==============================================================================
# SLIDE 6: Sub-Millisecond Targeted Signaling ($O(1)$)
# ==============================================================================
s6 = prs.slides.add_slide(blank_layout)
set_slide_background(s6)
add_header(s6, "Signaling Innovation", "Eliminating Global Broadcast Storms", "Redis gateway mapping and NATS targeted queues achieve O(1) signaling delivery.")

add_bullets_card(
    s6, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "How Targeted Routing Works",
    [
        "Dynamic Gateway Registry: When a user connects, their specific gateway pod ID is stored in Redis (TTL: 120s, refreshed by heartbeats).",
        "O(1) Direct Dispatch: Call invitations are routed directly to the exact pod holding the callee (chat.event.update.notify.<pod_id>).",
        "Eliminates 99.99% Network Waste: Avoids broadcasting WebRTC SDP packets to uninvolved nodes across the cluster.",
        "Infinite Loop Protection: Automatic envelope inspection ensures events never loop back to originators."
    ],
    BORDER_CYAN
)

add_image_card(
    s6, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7),
    os.path.join(CHARTS_DIR, "chart_signaling_fanout.png")
)

add_footer(s6, 6, 10, "Targeted NATS Dispatch • Zero Broadcast Storms")
set_speaker_notes(s6, "In standard platforms, sending a call invite generates 10,000 packets across clusters. Confeet reduces this to exactly 1 targeted packet via Redis node mapping, completely protecting gateway CPU.")


# ==============================================================================
# SLIDE 7: Deterministic Message Ordering & Sync
# ==============================================================================
s7 = prs.slides.add_slide(blank_layout)
set_slide_background(s7)
add_header(s7, "Data Consistency", "Deterministic FIFO Message Ordering", "Monotonic 64-bit sequence counters backed by Kafka event streams and MongoDB.")

add_bullets_card(
    s7, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Why Monotonic Sequencing Matters",
    [
        "Clock Skew Immunity: Server timestamps fluctuate; strictly incrementing sequence numbers guarantee 100% accurate message order.",
        "Atomic Allocation: MongoDB findAndModify allocates sequence IDs atomically per conversation with zero collision risk.",
        "Client Gap Detection: If a mobile app receives sequence #14 after #12, it immediately requests delta sync for #13.",
        "Audit & Compliance: Kafka retained topics provide an immutable, replayable event log for enterprise compliance."
    ],
    BORDER_CYAN
)

# Right: Visual Step Flow
step_card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7))
step_card.fill.solid()
step_card.fill.fore_color.rgb = BG_CARD
step_card.line.color.rgb = BORDER_SUBTLE

tb = s7.shapes.add_textbox(Inches(7.1), Inches(2.1), Inches(5.133), Inches(4.2))
tf = tb.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
p.text = "Reliability Lifecycle"
p.font.name = "Arial"
p.font.size = Pt(16)
p.font.bold = True
p.font.color.rgb = TEXT_EMERALD
p.space_after = Pt(14)

steps = [
    ("1. Client Ingress", "WSS frame received by gateway hub"),
    ("2. Atomic Sequence", "MongoDB assigns next monotonic integer"),
    ("3. Durable Commit", "Message committed to Apache Kafka topic"),
    ("4. Sub-ms Fan-out", "NATS JetStream broadcasts to online recipients"),
    ("5. Smart Push Fallback", "FCM/APNs triggered only if user is offline")
]

for title, desc in steps:
    pt = tf.add_paragraph()
    pt.text = f"✔  {title}"
    pt.font.name = "Arial"
    pt.font.size = Pt(11.5)
    pt.font.bold = True
    pt.font.color.rgb = TEXT_WHITE
    pt.space_before = Pt(8)

    pd = tf.add_paragraph()
    pd.text = f"    {desc}"
    pd.font.name = "Arial"
    pd.font.size = Pt(9.5)
    pd.font.color.rgb = TEXT_GRAY

add_footer(s7, 7, 10, "Atomic Monotonic Sequencing • Multi-Device Sync")
set_speaker_notes(s7, "For CEOs and compliance officers, data integrity is paramount. Confeet's atomic monotonic sequencing ensures messages are never lost or displayed out of order, even across mobile reconnections.")


# ==============================================================================
# SLIDE 8: Concurrency, Efficiency & Memory Density
# ==============================================================================
s8 = prs.slides.add_slide(blank_layout)
set_slide_background(s8)
add_header(s8, "Concurrency & Efficiency", "High Density: 50,000 Users on 250 MB RAM", "Go's lightweight goroutine scheduler delivers 20x higher memory efficiency than Java or Node.js.")

add_bullets_card(
    s8, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Cloud Resource Optimization",
    [
        "Goroutine Memory Density: Each WebSocket connection requires just ~2 KB of memory (versus 512 KB in traditional thread-per-client models).",
        "Massive Cost Reduction: Run 50,000 concurrent enterprise users on a single modest cloud instance (under 250 MB RAM).",
        "Stateless Auto-Healing: Pods restart in under 500ms without dropping sessions or corrupting user state.",
        "Linear Kubernetes HPA: NATS Queue Groups load-balance traffic cleanly across pods with zero coordination bottleneck."
    ],
    BORDER_CYAN
)

add_image_card(
    s8, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7),
    os.path.join(CHARTS_DIR, "chart_memory_concurrency.png")
)

add_footer(s8, 8, 10, "Go Runtime Efficiency • Kubernetes Scalability")
set_speaker_notes(s8, "This chart demonstrates why our infrastructure costs are so low: 50,000 active connections take 12.5 GB in Java and 6.2 GB in Node.js. Confeet's Go architecture handles the same load on just 250 MB of RAM.")


# ==============================================================================
# SLIDE 9: Enterprise Security, Governance & Moderation
# ==============================================================================
s9 = prs.slides.add_slide(blank_layout)
set_slide_background(s9)
add_header(s9, "Security & Compliance", "Enterprise Zero-Trust Security & Control", "End-to-end transport encryption, signed JWT authentication, and host moderation.")

card_w4 = Inches(2.72)
card_h4 = Inches(4.7)

add_bullets_card(
    s9, Inches(0.8), Inches(1.85), card_w4, card_h4,
    "🛡️ Transport Security",
    [
        "TLS 1.3 encryption",
        "Secure WebSockets (WSS)",
        "WebRTC DTLS-SRTP media",
        "Encrypted data channels",
        "VPC network isolation"
    ],
    BORDER_CYAN
)
add_bullets_card(
    s9, Inches(3.78), Inches(1.85), card_w4, card_h4,
    "🔑 Zero-Trust Auth",
    [
        "Cryptographic JWT tokens",
        "Per-request claim check",
        "Channel permission RBAC",
        "Automatic token refresh",
        "Immediate session revoke"
    ],
    TEXT_PURPLE
)
add_bullets_card(
    s9, Inches(6.76), Inches(1.85), card_w4, card_h4,
    "📋 Compliance & Audit",
    [
        "Immutable Kafka log",
        "SOC 2 audit ready",
        "HIPAA data safeguards",
        "GDPR data compliance",
        "100% data sovereignty"
    ],
    TEXT_EMERALD
)
add_bullets_card(
    s9, Inches(9.74), Inches(1.85), card_w4, card_h4,
    "🎛️ Host Moderation",
    [
        "Host mute-all command",
        "Lock conference room",
        "Dismiss unauthorized users",
        "Screen share permissions",
        "Audio telemetry monitoring"
    ],
    TEXT_PINK
)

add_footer(s9, 9, 10, "DTLS-SRTP • TLS 1.3 • Zero-Trust Access Control")
set_speaker_notes(s9, "Security is built-in, not bolted on. All media is encrypted with DTLS-SRTP, all API requests are verified with signed JWTs, and hosts have complete moderation power to lock rooms and mute participants.")


# ==============================================================================
# SLIDE 10: Executive ROI & Strategic Cost Savings
# ==============================================================================
s10 = prs.slides.add_slide(blank_layout)
set_slide_background(s10)
add_header(s10, "Executive Business Case", "Strategic ROI: 70%+ Reduction in SaaS Costs", "Replacing fragmented per-seat collaboration licenses with an owned, high-margin platform.")

add_bullets_card(
    s10, Inches(0.8), Inches(1.85), Inches(5.6), Inches(4.7),
    "Quantifiable Value Drivers",
    [
        "76% Average Cost Reduction: Save $175k/year for 1,000 users and up to $3.1M/year for 15,000 users over commercial SaaS bundles.",
        "100% Data Sovereignty: All messages, files, and video streams remain strictly in your enterprise VPC / private cloud.",
        "Zero Vendor Lock-In: Open standards (WebRTC, NATS, Kafka, MongoDB) eliminate unpredictable vendor price hikes.",
        "AI Innovation Ready: Built-in hooks for live meeting transcription, action item summaries, and enterprise support bots."
    ],
    TEXT_EMERALD
)

add_image_card(
    s10, Inches(6.8), Inches(1.85), Inches(5.733), Inches(4.7),
    os.path.join(CHARTS_DIR, "chart_tco_savings.png")
)

add_footer(s10, 10, 10, "Transforming Communication from a Cost Center to an Asset")
set_speaker_notes(s10, "To conclude: As shown on this TCO chart, Confeet saves over 70% in operational costs across all enterprise tiers. For a 5,000-user enterprise, you save over $1 Million annually while retaining complete ownership of your data.")

# Save presentation
prs.save(OUTPUT_PATH)
print(f"Executive Presentation successfully generated at: {OUTPUT_PATH}")
