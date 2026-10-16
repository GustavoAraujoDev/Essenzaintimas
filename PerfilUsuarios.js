
(() => {
  "use strict";

  // =========================================================
  // CONFIGURAÇÃO
  // =========================================================

  const API_BASE_URL = "https://essenzaintimasapi.onrender.com/products";

  const ENDPOINTS = {
    profile: "/users/me",
    changeEmail: "/users/me/email",
    confirmEmail: "/users/me/email/confirm",
    changePassword: "/users/me/password"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const state = {
    profile: null,
    profileLoaded: false,
    profileLoading: false,
    activeTab: "profile"
  };

  // =========================================================
  // ELEMENTOS
  // =========================================================

  const tabs = $$("[data-tab]");
  const panels = $$(".tab-panel[data-panel]");

  const globalNotice = $("#globalNotice");
  const profileLoading = $("#profileLoading");

  const profileForm = $("#profileForm");
  const emailForm = $("#emailForm");
  const passwordForm = $("#passwordForm");

  const profileMessage = $("#profileMessage");
  const emailMessage = $("#emailMessage");
  const passwordMessage = $("#passwordMessage");

  const profileName = $("#profileName");
  const profilePhone = $("#profilePhone");
  const profileEmail = $("#profileEmail");

  const summaryName = $("#summaryName");
  const summaryEmail = $("#summaryEmail");
  const profileAvatar = $("#profileAvatar");

  // =========================================================
  // UTILITÁRIOS
  // =========================================================

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getInitial(name) {
    const cleaned = normalizeText(name);
    return cleaned ? cleaned.charAt(0).toLocaleUpperCase("pt-BR") : "E";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(email));
  }

  function setButtonLoading(button, loading, loadingText = "Processando...") {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = loadingText;
      return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message show ${type}`;
  }

  function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.className = "form-message";
  }

  function showGlobalNotice(message, type = "info") {
    if (!globalNotice) return;

    globalNotice.textContent = message;
    globalNotice.className = `global-notice show ${type}`;

    globalNotice.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function clearGlobalNotice() {
    if (!globalNotice) return;

    globalNotice.textContent = "";
    globalNotice.className = "global-notice";
  }

  function setProfileLoading(loading) {
    if (!profileLoading) return;

    profileLoading.classList.toggle("show", loading);
    profileLoading.setAttribute("aria-hidden", String(!loading));
  }

  function getErrorMessage(data, fallback) {
    if (typeof data === "string" && data.trim()) {
      return data.trim();
    }

    if (data && typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
      }

      if (typeof data.error === "string" && data.error.trim()) {
        return data.error.trim();
      }

      if (Array.isArray(data.errors) && data.errors.length) {
        return data.errors
          .map((item) => {
            if (typeof item === "string") return item;
            return item?.message || "";
          })
          .filter(Boolean)
          .join(" ");
      }
    }

    return fallback;
  }

  // =========================================================
  // COMUNICAÇÃO COM A API
  // =========================================================

  async function apiRequest(path, options = {}) {
    const {
      method = "GET",
      body,
      headers = {}
    } = options;

    const requestHeaders = {
      Accept: "application/json",
      ...headers
    };

    const requestOptions = {
      method,
      headers: requestHeaders,
      credentials: "include"
    };

    if (body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(body);
    }

    let response;

    try {
      response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
    } catch (error) {
      const networkError = new Error(
        "Não foi possível conectar à Essenza. Verifique sua internet e tente novamente."
      );

      networkError.cause = error;
      throw networkError;
    }

    const contentType = response.headers.get("content-type") || "";
    let data = null;

    if (response.status !== 204) {
      try {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text ? { message: text } : null;
        }
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Sua sessão não está autenticada ou expirou. Entre novamente na sua conta."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Você não tem permissão para realizar essa alteração."
        );
      }

      throw new Error(
        getErrorMessage(
          data,
          `Não foi possível concluir a solicitação (HTTP ${response.status}).`
        )
      );
    }

    return data;
  }

  // =========================================================
  // NAVEGAÇÃO ENTRE AS ABAS
  // =========================================================

  function showTab(tabName, focus = false) {
    const validTab = tabs.some((tab) => tab.dataset.tab === tabName);

    if (!validTab) return;

    state.activeTab = tabName;

    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === tabName;

      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      const selected = panel.dataset.panel === tabName;

      panel.hidden = !selected;
      panel.setAttribute("aria-hidden", String(!selected));
    });

    clearGlobalNotice();

    if (focus) {
      const selectedTab = $(`#tab-${tabName}`);

      if (selectedTab) selectedTab.focus();
    }
  }

  function initializeTabs() {
    if (!tabs.length || !panels.length) {
      console.error(
        "Essenza: não foi possível inicializar as abas. Confira os atributos data-tab e data-panel no HTML."
      );
      return;
    }

    // Um único listener por botão.
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        showTab(tab.dataset.tab);
      });

      tab.addEventListener("keydown", (event) => {
        const allowedKeys = ["ArrowRight", "ArrowLeft", "Home", "End"];

        if (!allowedKeys.includes(event.key)) return;

        event.preventDefault();

        let nextIndex = index;

        if (event.key === "ArrowRight") {
          nextIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft") {
          nextIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        }

        const nextTab = tabs[nextIndex];

        if (nextTab) {
          showTab(nextTab.dataset.tab, true);
        }
      });
    });

    // Garante que o painel inicial esteja sincronizado com a aba.
    showTab("profile");
  }

  // =========================================================
  // EXIBIÇÃO DOS DADOS DO PERFIL
  // =========================================================

  function extractUser(data) {
    if (!data || typeof data !== "object") return null;

    // Aceita formatos comuns de resposta da API.
    const candidate =
      data.user ||
      data.usuario ||
      data.data?.user ||
      data.data?.usuario ||
      data.data ||
      data;

    if (!candidate || typeof candidate !== "object") return null;

    return candidate;
  }

  function applyProfile(user) {
    if (!user) return;

    state.profile = user;
    state.profileLoaded = true;

    const name = normalizeText(
      user.profile.name ?? user.profile.nome ?? user.profile.fullName ?? user.profile.full_name
    );

    const email = normalizeText(
      user.email ?? user.e_mail
    );

    const phone = normalizeText(
      user.profile.phone ??
      user.profile.telefone ??
      user.profile.cellphone ??
      user.profile.celular ??
      user.profile.whatsapp
    );

    if (profileName) profileName.value = name;
    if (profilePhone) profilePhone.value = phone;
    if (profileEmail) profileEmail.value = email;

    const currentEmail = $("#currentEmail");

    if (currentEmail) {
      currentEmail.value = email;
    }

    if (summaryName) {
      summaryName.textContent = name || "Minha conta";
    }

    if (summaryEmail) {
      summaryEmail.textContent = email || "E-mail não informado";
    }

    if (profileAvatar) {
      profileAvatar.textContent = getInitial(name);
    }
  }

  async function loadProfile({ silent = false } = {}) {
    if (state.profileLoading) return;

    state.profileLoading = true;

    if (!silent) {
      setProfileLoading(true);
      clearMessage(profileMessage);
      clearGlobalNotice();
    }

    try {
      const data = await apiRequest(ENDPOINTS.profile);
      const user = extractUser(data);

      if (!user) {
        throw new Error(
          "A API respondeu, mas não retornou os dados esperados do perfil."
        );
      }

      applyProfile(user);
    } catch (error) {
      console.error("Essenza: erro ao carregar perfil:", error);

      if (!silent) {
        showGlobalNotice(
          error.message ||
            "Não foi possível carregar seus dados. Tente novamente.",
          "error"
        );
      }
    } finally {
      state.profileLoading = false;
      setProfileLoading(false);
    }
  }

  // =========================================================
  // DADOS PESSOAIS
  // =========================================================

  function getProfilePayload() {
    return {
      name: normalizeText(profileName?.value),
      phone: normalizeText(profilePhone?.value)
    };
  }

  function validateProfile(payload) {
    if (payload.name.length < 2) {
      showMessage(
        profileMessage,
        "Informe seu nome completo com pelo menos 2 caracteres.",
        "error"
      );

      profileName?.focus();
      return false;
    }

    if (payload.name.length > 120) {
      showMessage(
        profileMessage,
        "O nome deve ter no máximo 120 caracteres.",
        "error"
      );

      profileName?.focus();
      return false;
    }

    return true;
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    clearMessage(profileMessage);
    clearGlobalNotice();

    const payload = getProfilePayload();

    if (!validateProfile(payload)) return;

    const button = $("#saveProfile");
    setButtonLoading(button, true, "Salvando...");

    try {
      const response = await apiRequest(ENDPOINTS.profile, {
        method: "PATCH",
        body: payload
      });

      // Se o servidor retornar os dados atualizados, usa-os.
      const updatedUser = extractUser(response);

      if (updatedUser) {
        applyProfile({
          ...(state.profile || {}),
          ...updatedUser,
          name: updatedUser.name ?? updatedUser.nome ?? payload.name,
          phone:
            updatedUser.phone ??
            updatedUser.telefone ??
            payload.phone
        });
      } else {
        applyProfile({
          ...(state.profile || {}),
          name: payload.name,
          phone: payload.phone
        });
      }

      showMessage(
        profileMessage,
        getErrorMessage(
          response,
          "Seus dados foram atualizados com sucesso."
        ),
        "success"
      );
    } catch (error) {
      console.error("Essenza: erro ao atualizar perfil:", error);

      showMessage(
        profileMessage,
        error.message || "Não foi possível salvar seus dados.",
        "error"
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  function handleProfileReset() {
    clearMessage(profileMessage);

    if (state.profile) {
      applyProfile(state.profile);
    }
  }

  // =========================================================
  // ALTERAÇÃO DO E-MAIL
  // =========================================================

  async function handleEmailSubmit(event) {
    event.preventDefault();

    clearMessage(emailMessage);
    clearGlobalNotice();

    const newEmail = normalizeText($("#newEmail")?.value).toLowerCase();
    const currentPassword = $("#emailCurrentPassword")?.value || "";
    const currentEmail = normalizeText(profileEmail?.value).toLowerCase();

    if (!isValidEmail(newEmail)) {
      showMessage(
        emailMessage,
        "Digite um endereço de e-mail válido.",
        "error"
      );

      $("#newEmail")?.focus();
      return;
    }

    if (newEmail === currentEmail) {
      showMessage(
        emailMessage,
        "O novo e-mail precisa ser diferente do e-mail atual.",
        "error"
      );

      $("#newEmail")?.focus();
      return;
    }

    if (!currentPassword) {
      showMessage(
        emailMessage,
        "Informe sua senha atual para confirmar a alteração.",
        "error"
      );

      $("#emailCurrentPassword")?.focus();
      return;
    }

    const button = $("#saveEmail");
    setButtonLoading(button, true, "Enviando solicitação...");

    try {
      const response = await apiRequest(ENDPOINTS.changeEmail, {
        method: "PATCH",
        body: {
          newEmail,
          currentPassword
        }
      });

      if (emailForm) emailForm.reset();

      showMessage(
        emailMessage,
        getErrorMessage(
          response,
          "Solicitação enviada. Se a confirmação por e-mail estiver habilitada, verifique sua caixa de entrada."
        ),
        "success"
      );

      // Não altera o e-mail exibido até que a API confirme a mudança.
    } catch (error) {
      console.error("Essenza: erro ao solicitar alteração de e-mail:", error);

      showMessage(
        emailMessage,
        error.message || "Não foi possível solicitar a alteração do e-mail.",
        "error"
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function handleEmailConfirmationFromUrl() {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");

    if (!token) return;

    // Evita enviar token vazio ou apenas espaços.
    if (!token.trim()) return;

    showTab("email");

    showMessage(
      emailMessage,
      "Confirmando alteração do e-mail...",
      "info"
    );

    try {
      const response = await apiRequest(ENDPOINTS.confirmEmail, {
        method: "POST",
        body: { token }
      });

      showMessage(
        emailMessage,
        getErrorMessage(
          response,
          "Confirmação concluída. Seu e-mail foi atualizado, se a API confirmou a solicitação."
        ),
        "success"
      );

      await loadProfile({ silent: true });
    } catch (error) {
      console.error("Essenza: erro ao confirmar e-mail:", error);

      showMessage(
        emailMessage,
        error.message ||
          "Não foi possível confirmar o e-mail. Verifique se o link ainda é válido.",
        "error"
      );
    } finally {
      // Remove o token da barra de endereço depois da tentativa.
      url.searchParams.delete("token");

      window.history.replaceState(
        {},
        document.title,
        `${url.pathname}${url.search}${url.hash}`
      );
    }
  }

  // =========================================================
  // ALTERAÇÃO DA SENHA
  // =========================================================

  function updatePasswordRules() {
    const currentPassword = $("#currentPassword")?.value || "";
    const newPassword = $("#newPassword")?.value || "";
    const confirmPassword = $("#confirmPassword")?.value || "";

    $("#ruleLength")?.classList.toggle(
      "valid",
      newPassword.length >= 8
    );

    $("#ruleMatch")?.classList.toggle(
      "valid",
      confirmPassword.length > 0 &&
        newPassword === confirmPassword
    );

    $("#ruleDifferent")?.classList.toggle(
      "valid",
      currentPassword.length > 0 &&
        newPassword.length > 0 &&
        newPassword !== currentPassword
    );
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    clearMessage(passwordMessage);
    clearGlobalNotice();

    const currentPassword = $("#currentPassword")?.value || "";
    const newPassword = $("#newPassword")?.value || "";
    const confirmPassword = $("#confirmPassword")?.value || "";

    if (!currentPassword) {
      showMessage(
        passwordMessage,
        "Informe sua senha atual.",
        "error"
      );

      $("#currentPassword")?.focus();
      return;
    }

    if (newPassword.length < 8) {
      showMessage(
        passwordMessage,
        "A nova senha precisa ter pelo menos 8 caracteres.",
        "error"
      );

      $("#newPassword")?.focus();
      return;
    }

    if (newPassword.length > 128) {
      showMessage(
        passwordMessage,
        "A nova senha deve ter no máximo 128 caracteres.",
        "error"
      );

      $("#newPassword")?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        passwordMessage,
        "A confirmação não corresponde à nova senha.",
        "error"
      );

      $("#confirmPassword")?.focus();
      return;
    }

    if (newPassword === currentPassword) {
      showMessage(
        passwordMessage,
        "Escolha uma senha diferente da atual.",
        "error"
      );

      $("#newPassword")?.focus();
      return;
    }

    const button = $("#savePassword");
    setButtonLoading(button, true, "Atualizando senha...");

    try {
      const response = await apiRequest(ENDPOINTS.changePassword, {
        method: "PATCH",
        body: {
          currentPassword,
          newPassword,
          confirmPassword
        }
      });

      if (passwordForm) passwordForm.reset();

      updatePasswordRules();

      showMessage(
        passwordMessage,
        getErrorMessage(
          response,
          "Sua senha foi atualizada com sucesso."
        ),
        "success"
      );
    } catch (error) {
      console.error("Essenza: erro ao atualizar senha:", error);

      showMessage(
        passwordMessage,
        error.message || "Não foi possível atualizar sua senha.",
        "error"
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  // =========================================================
  // MOSTRAR / OCULTAR SENHA
  // =========================================================

  function initializePasswordVisibility() {
    $$("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const inputId = button.dataset.togglePassword;
        const input = document.getElementById(inputId);

        if (!input) return;

        const shouldShow = input.type === "password";

        input.type = shouldShow ? "text" : "password";
        button.textContent = shouldShow ? "Ocultar" : "Mostrar";

        button.setAttribute(
          "aria-label",
          shouldShow ? "Ocultar senha" : "Mostrar senha"
        );
      });
    });
  }

  // =========================================================
  // INICIALIZAÇÃO
  // =========================================================

  function initializeForms() {
    profileForm?.addEventListener("submit", handleProfileSubmit);
    emailForm?.addEventListener("submit", handleEmailSubmit);
    passwordForm?.addEventListener("submit", handlePasswordSubmit);

    profileForm?.addEventListener("reset", () => {
      // Espera o navegador concluir o reset antes de restaurar os dados.
      window.setTimeout(handleProfileReset, 0);
    });

    $("#currentPassword")?.addEventListener("input", updatePasswordRules);
    $("#newPassword")?.addEventListener("input", updatePasswordRules);
    $("#confirmPassword")?.addEventListener("input", updatePasswordRules);

    // Ao digitar, remove mensagens antigas de validação.
    $("#newEmail")?.addEventListener("input", () => {
      clearMessage(emailMessage);
    });

    [profileName, profilePhone].forEach((input) => {
      input?.addEventListener("input", () => {
        clearMessage(profileMessage);
      });
    });

    [$("#currentPassword"), $("#newPassword"), $("#confirmPassword")].forEach(
      (input) => {
        input?.addEventListener("input", () => {
          clearMessage(passwordMessage);
        });
      }
    );
  }

  function initializePage() {
    const yearElement = $("#currentYear");

    if (yearElement) {
      yearElement.textContent = String(new Date().getFullYear());
    }

    initializeTabs();
    initializeForms();
    initializePasswordVisibility();
    updatePasswordRules();

    // Carrega os dados da conta.
    loadProfile();

    // Se a URL contiver ?token=..., tenta confirmar o e-mail.
    handleEmailConfirmationFromUrl();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, {
      once: true
    });
  } else {
    initializePage();
  }
})();
