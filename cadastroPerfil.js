
"use strict";

const API_BASE =
  "https://essenzaintimasapi.onrender.com/products";

const REGISTER_ENDPOINT = `${API_BASE}/auth/registrar`;
const ME_ENDPOINT = `${API_BASE}/users/me`;

const container = document.getElementById("container");
const form = document.getElementById("formCadastro");
const roleSelect = document.getElementById("role");
const empresaSection = document.getElementById("empresaSection");
const btnCadastrar = document.getElementById("btnCadastrar");
const mensagem = document.getElementById("mensagem");

let adminVerificado = false;

function campo(id) {
  return document.getElementById(id).value.trim();
}

function mostrarMensagem(texto, tipo = "info") {
  mensagem.textContent = texto;
  mensagem.className = tipo;
}

function atualizarTipoUsuario() {
  const isAdmin = roleSelect.value === "ADMIN";

  empresaSection.hidden = !isAdmin;

  document.getElementById("companyName").required = isAdmin;
  document.getElementById("companyDocument").required = isAdmin;
}

async function verificarAdministrador() {
  container.hidden = true;
  adminVerificado = false;

  try {
    const response = await fetch(ME_ENDPOINT, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Sua sessão expirou. Entre novamente como administrador."
          : `Não foi possível validar sua conta (HTTP ${response.status}).`
      );
    }

    const usuario = await response.json();

    adminVerificado = true;
    container.hidden = false;
    atualizarTipoUsuario();
  } catch (error) {
    document.body.innerHTML = `
      <main style="
        max-width:450px;
        margin:70px auto;
        padding:24px;
        font-family:Arial,sans-serif;
        text-align:center
      ">
        <h1>Autenticação necessária</h1>
        <p>${error.message}</p>
        <button onclick="location.reload()">Tentar novamente</button>
      </main>
    `;
  }
}

roleSelect.addEventListener("change", atualizarTipoUsuario);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!adminVerificado) {
    mostrarMensagem(
      "Acesso não autorizado. Verifique sua sessão.",
      "erro"
    );
    return;
  }

  const email = campo("email").toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword =
    document.getElementById("confirmPassword").value;

  const role = roleSelect.value;

  if (password.length < 8) {
    mostrarMensagem(
      "A senha precisa ter pelo menos 8 caracteres.",
      "erro"
    );
    return;
  }

  if (password !== confirmPassword) {
    mostrarMensagem("As senhas não coincidem.", "erro");
    return;
  }

  const customerData = {
    name: campo("name"),
    phone: campo("phone") || null,
    document: campo("document") || null
  };

  const payload = {
    email,
    password,
    role,
    customerData
  };

  if (role === "ADMIN") {
    payload.companyData = {
      name: campo("companyName"),
      document: campo("companyDocument"),
      email: campo("companyEmail") || email,
      phone: campo("companyPhone") || null
    };
  }

  btnCadastrar.disabled = true;
  btnCadastrar.textContent = "Cadastrando...";
  mostrarMensagem("Enviando cadastro...", "info");

  try {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || `Erro no cadastro (HTTP ${response.status}).`
      );
    }

    mostrarMensagem(
      "Conta cadastrada com sucesso!\n\n" +
      `E-mail: ${data.email || email}\n` +
      `Tipo: ${data.role || role}\n\n` +
      "Confirme no banco de dados se o perfil pessoal foi criado.",
      "sucesso"
    );

    form.reset();
    atualizarTipoUsuario();
  } catch (error) {
    mostrarMensagem(
      "Não foi possível concluir o cadastro.\n\n" +
      error.message +
      "\n\nConfira a rota da API, a autenticação e o CORS.",
      "erro"
    );
  } finally {
    btnCadastrar.disabled = false;
    btnCadastrar.textContent = "Criar conta e perfil";
  }
});

atualizarTipoUsuario();
verificarAdministrador();
