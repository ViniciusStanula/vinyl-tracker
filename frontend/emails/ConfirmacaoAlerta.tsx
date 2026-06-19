import type { CSSProperties } from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

interface Props {
  titulo: string;
  artista: string;
  maxPrice: number;
  confirmUrl: string;
  manageUrl: string;
}

export default function ConfirmacaoAlerta({
  titulo,
  artista,
  maxPrice,
  confirmUrl,
  manageUrl,
}: Props) {
  const maxPriceFormatted = maxPrice.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Confirme seu alerta de preço para {titulo}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Garimpa Vinil</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Confirme seu alerta</Heading>
            <Text style={paragraph}>
              Você pediu para ser avisado quando o preço de{" "}
              <strong style={strong}>{titulo}</strong>
              {artista ? ` — ${artista}` : ""} cair para{" "}
              <strong style={strong}>{maxPriceFormatted}</strong> ou menos.
            </Text>
            <Text style={paragraph}>
              Clique no botão abaixo para confirmar. O alerta só começa a
              funcionar após a confirmação.
            </Text>

            <Section style={{ textAlign: "center", margin: "28px 0" }}>
              <Button href={confirmUrl} style={button}>
                Confirmar alerta
              </Button>
            </Section>

            <Text style={fine}>
              O link expira em 7 dias. Se você não pediu este alerta, pode
              ignorar este e-mail — nenhuma ação é necessária.
            </Text>

            <Hr style={hr} />

            <Text style={footer}>
              Garimpa Vinil · rastreador de preços de vinil na Amazon Brasil
              <br />
              <a href={manageUrl} style={link}>
                Gerenciar alerta
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: CSSProperties = {
  backgroundColor: "#1a1a1a",
  fontFamily: "sans-serif",
  margin: 0,
  padding: "24px",
};

const container: CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  backgroundColor: "#242424",
  borderRadius: "10px",
  overflow: "hidden",
  border: "1px solid #333",
};

const header: CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "20px 28px",
  borderBottom: "1px solid #333",
};

const brand: CSSProperties = {
  color: "#c9a84c",
  fontSize: "16px",
  fontWeight: "bold",
  letterSpacing: "0.5px",
  margin: 0,
};

const content: CSSProperties = {
  padding: "28px",
};

const h1: CSSProperties = {
  color: "#f0e6cc",
  fontSize: "20px",
  fontWeight: "bold",
  margin: "0 0 16px",
};

const paragraph: CSSProperties = {
  color: "#a89070",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 14px",
};

const strong: CSSProperties = {
  color: "#f0e6cc",
};

const button: CSSProperties = {
  backgroundColor: "#c9a84c",
  color: "#1a1a1a",
  padding: "13px 32px",
  borderRadius: "6px",
  fontWeight: "bold",
  fontSize: "15px",
  textDecoration: "none",
  display: "inline-block",
};

const fine: CSSProperties = {
  color: "#666",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const hr: CSSProperties = {
  borderColor: "#333",
  margin: "0 0 18px",
};

const footer: CSSProperties = {
  color: "#666",
  fontSize: "12px",
  lineHeight: "1.6",
  textAlign: "center",
  margin: 0,
};

const link: CSSProperties = {
  color: "#888",
  textDecoration: "underline",
};
