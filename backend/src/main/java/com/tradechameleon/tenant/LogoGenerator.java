package com.tradechameleon.tenant;

import org.springframework.stereotype.Component;

/**
 * Generates each broker's SVG logo from its theme. No binary assets: the logo is code, so a new
 * tenant gets a logo just by choosing a {@code logo_shape} and colors in the database.
 */
@Component
public class LogoGenerator {

    /** Logo marks an admin can pick; "monogram" draws the first letter of the broker name. */
    public static final java.util.List<String> SHAPES =
            java.util.List.of("aurora", "kestrel", "wisla", "sakura", "alpenrose", "pulse", "monogram");


    public String svg(Tenant tenant) {
        var t = tenant.theme();
        String mark = switch (tenant.logoShape()) {
            case "aurora" -> aurora(t.primary(), t.accent());
            case "kestrel" -> kestrel(t.primary(), t.accent());
            case "wisla" -> wisla(t.primary(), t.accent());
            case "sakura" -> sakura(t.primary(), t.accent());
            case "alpenrose" -> alpenrose(t.primary(), t.accent());
            case "pulse" -> pulse(t.primary(), t.accent());
            default -> monogram(t.primary(), t.onPrimary(), tenant.name().substring(0, 1));
        };
        return """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="%s logo">
                  <title>%s</title>
                  %s
                </svg>
                """.formatted(escape(tenant.name()), escape(tenant.name()), mark);
    }

    /** Three northern-light ribbons over a dark sky disc. */
    private String aurora(String primary, String accent) {
        return """
                <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stop-color="%1$s"/><stop offset="1" stop-color="%2$s"/></linearGradient></defs>
                <circle cx="32" cy="32" r="30" fill="#0b1f1c"/>
                <path d="M8 40 C 20 18, 30 50, 56 22" stroke="url(#g)" stroke-width="5" fill="none" stroke-linecap="round"/>
                <path d="M10 48 C 24 30, 34 58, 54 34" stroke="%1$s" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
                <circle cx="46" cy="16" r="2.5" fill="%2$s"/>
                """.formatted(primary, accent);
    }

    /** A hexagon with a diving kestrel built from two chevrons. */
    private String kestrel(String primary, String accent) {
        return """
                <polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="#141b2d" stroke="%1$s" stroke-width="3"/>
                <path d="M14 24 L32 40 L50 24" stroke="%1$s" stroke-width="5" fill="none" stroke-linejoin="round"/>
                <path d="M22 22 L32 31 L42 22" stroke="%2$s" stroke-width="4" fill="none" stroke-linejoin="round"/>
                """.formatted(primary, accent);
    }

    /** A square with a winding river (the Vistula) running from mountains to the sea. */
    private String wisla(String primary, String accent) {
        return """
                <rect x="3" y="3" width="58" height="58" rx="3" fill="%1$s"/>
                <path d="M10 18 L20 8 L28 16 L36 6 L46 18" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
                <path d="M30 22 C 14 30, 46 38, 26 46 S 34 58, 40 60" fill="none" stroke="%2$s" stroke-width="6" stroke-linecap="round"/>
                <path d="M30 22 C 14 30, 46 38, 26 46 S 34 58, 40 60" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                """.formatted(primary, accent);
    }

    /** A five-petal cherry blossom. */
    private String sakura(String primary, String accent) {
        StringBuilder petals = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            petals.append("""
                    <ellipse cx="32" cy="16" rx="9" ry="14" fill="%s" opacity=".9" transform="rotate(%d 32 32)"/>
                    """.formatted(primary, i * 72));
        }
        return petals + """
                <circle cx="32" cy="32" r="7" fill="%s"/>
                <circle cx="32" cy="32" r="3" fill="#ffffff"/>
                """.formatted(accent);
    }

    /** A shield with snowy peaks and a small alpine rose. */
    private String alpenrose(String primary, String accent) {
        return """
                <path d="M32 3 L57 11 V30 C57 46 46 56 32 61 C18 56 7 46 7 30 V11 Z" fill="%1$s"/>
                <path d="M12 40 L24 22 L31 31 L38 19 L52 40 Z" fill="#ffffff" opacity=".92"/>
                <path d="M21 27 L24 22 L27 27 Z M35 24 L38 19 L41 24 Z" fill="%1$s" opacity=".35"/>
                <circle cx="32" cy="47" r="5" fill="%2$s"/>
                <circle cx="32" cy="47" r="2" fill="#ffffff"/>
                """.formatted(primary, accent);
    }

    /** A neon heartbeat line on a dark rounded square. */
    private String pulse(String primary, String accent) {
        return """
                <rect x="3" y="3" width="58" height="58" rx="16" fill="#151521"/>
                <path d="M9 34 H22 L27 20 L34 46 L39 30 H55" fill="none" stroke="%1$s" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="55" cy="30" r="4" fill="%2$s"/>
                """.formatted(primary, accent);
    }

    private String monogram(String bg, String fg, String letter) {
        return """
                <rect width="64" height="64" rx="14" fill="%s"/>
                <text x="32" y="43" font-size="32" text-anchor="middle" fill="%s" font-family="sans-serif">%s</text>
                """.formatted(bg, fg, escape(letter));
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
