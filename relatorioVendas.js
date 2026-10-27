
"use strict";

/**
 * Relatório de vendas — Essenza Íntimas
 *
 * Rotas esperadas:
 * GET /vendas/relatorio
 * GET /vendas/relatorio.csv
 * GET /vendas/relatorio.pdf
 *
 * Configure RELATORIO_BASE conforme o caminho utilizado
 * no app.js/server.js para registrar criarRotasRelatorioVendas.
 */

const API_BASE = (
  window.API_BASE_URL || "https://essenzaintimasapi.onrender.com"
).replace(/\/+$/, "");

const RELATORIO_BASE = (
  window.RELATORIO_VENDAS_PATH || "/vendas"
).replace(/\/+$/, "");

const ENDPOINTS = {
  relatorio: `${API_BASE}${RELATORIO_BASE}/relatorio`,
  csv: `${API_BASE}${RELATORIO_BASE}/relatorio.csv`,
  pdf: `${API_BASE}${RELATORIO_BASE}/relatorio.pdf`,
};

const ITENS_POR_PAGINA = 10;

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const estado = {
  vendas: [],
  resumo: {},
  pagina: 1,
  totalPaginas: 1,
  totalRegistros: 0,
  consultado: false,
  carregando: false,
  filtros: {},
};

const $ = (id) => document.getElementById(id);

function formatarMoeda(valor) {
  const numero = Number(valor);
  return moeda.format(Number.isFinite(numero) ? numero : 0);
}

function formatarNumero(valor) {
  const numero = Number(valor);
  return new Intl.NumberFormat("pt-BR").format(
    Number.isFinite(numero) ? numero : 0
  );
}

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entidades[caractere];
  });
}

function obterValor(objeto, caminhos, padrao = null) {
  for (const caminho of caminhos) {
    const valor = caminho.split(".").reduce((atual, chave) => {
      return atual == null ? undefined : atual[chave];
    }, objeto);

    if (valor !== undefined && valor !== null) {
      return valor;
    }
  }

  return padrao;
}

function obterMensagemErro(dados, status) {
  if (typeof dados === "string" && dados.trim()) {
    return dados;
  }

  return (
    dados?.message ||
    dados?.mensagem ||
    dados?.erro ||
    `A API respondeu com HTTP ${status}.`
  );
}

async function lerResposta(response) {
  const tipo = response.headers.get("content-type") || "";

  if (tipo.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function construirParametros({ incluirPaginacao = false } = {}) {
  const parametros = new URLSearchParams();

  for (const [chave, valor] of Object.entries(estado.filtros)) {
    if (valor !== "" && valor != null) {
      parametros.set(chave, valor);
    }
  }

  if (incluirPaginacao) {
    parametros.set("pagina", String(estado.pagina));
    parametros.set("limite", String(ITENS_POR_PAGINA));
  }

  return parametros;
}

function atualizarPeriodoSelecionado() {
  const inicio = $("data-inicial").value;
  const fim = $("data-final").value;

  if (!inicio && !fim) {
    $("periodo-selecionado").textContent =
      "Período definido pela API.";
    return;
  }

  $("periodo-selecionado").textContent =
    `${inicio || "Início não informado"} até ${fim || "hoje"}`;
}

function coletarFiltros() {
  const dataInicial = $("data-inicial").value;
  const dataFinal = $("data-final").value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    throw new Error(
      "A data inicial não pode ser posterior à data final."
    );
  }

  const filtros = {
    dataInicial,
    dataFinal,
    status: $("status").value,
    metodoPagamento: $("metodo-pagamento").value,
    operador: $("operador").value.trim(),
    busca: $("busca").value.trim(),
  };

  estado.filtros = Object.fromEntries(
    Object.entries(filtros).filter(([, valor]) => valor !== "")
  );

  atualizarPeriodoSelecionado();
}

function obterLista(dados) {
  if (Array.isArray(dados)) {
    return dados;
  }

  const lista = obterValor(dados, [
    "vendas",
    "resultados",
    "relatorio.vendas",
    "dados.vendas",
    "data.vendas",
    "items",
    "itens",
    "results",
    "data",
  ]);

  return Array.isArray(lista) ? lista : [];
}

function obterResumo(dados, vendas) {
  const resumoRecebido = obterValor(dados, [
    "resumo",
    "indicadores",
    "estatisticas",
    "relatorio.resumo",
    "dados.resumo",
    "data.resumo",
  ], {});

  const faturamentoCalculado = vendas.reduce((soma, venda) => {
    if (venda.status !== "CONCLUIDA") return soma;
    return soma + Number(venda.total || 0);
  }, 0);

  const vendasConcluidas = vendas.filter(
    (venda) => venda.status === "CONCLUIDA"
  ).length;

  const faturamento = Number(
    obterValor(resumoRecebido, [
      "faturamento",
      "totalFaturamento",
      "totalVendido",
      "receita",
    ], faturamentoCalculado)
  );

  const quantidade = Number(
    obterValor(resumoRecebido, [
      "quantidadeVendas",
      "totalVendas",
      "numeroVendas",
      "vendasConcluidas",
    ], vendasConcluidas)
  );

  const ticketRecebido = obterValor(resumoRecebido, [
    "ticketMedio",
    "ticketMedioVendas",
  ]);

  const lucro = Number(
    obterValor(resumoRecebido, [
      "lucroBruto",
      "lucro",
      "totalLucroBruto",
    ], vendas.reduce((soma, venda) => {
      if (venda.status !== "CONCLUIDA") return soma;
      return soma + Number(venda.lucroBruto || 0);
    }, 0))
  );

  return {
    faturamento,
    quantidade,
    ticketMedio: ticketRecebido != null
      ? Number(ticketRecebido)
      : quantidade > 0
        ? faturamento / quantidade
        : 0,
    lucro,
  };
}

function atualizarIndicadores(resumo) {
  $("metric-faturamento").textContent =
    formatarMoeda(resumo.faturamento);

  $("metric-vendas").textContent =
    formatarNumero(resumo.quantidade);

  $("metric-ticket").textContent =
    formatarMoeda(resumo.ticketMedio);

  $("metric-lucro").textContent =
    formatarMoeda(resumo.lucro);
}

function formatarDataVenda(valor) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return escaparHTML(valor);
  }

  return dataHora.format(data);
}

function nomePagamento(metodo) {
  const nomes = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_CREDITO: "Crédito",
    CARTAO_DEBITO: "Débito",
    VALE: "Vale",
    OUTRO: "Outro",
  };

  return nomes[metodo] || metodo || "—";
}

function nomeStatus(status) {
  const nomes = {
    CONCLUIDA: "Concluída",
    PENDENTE: "Pendente",
    CANCELADA: "Cancelada",
    DEVOLVIDA: "Devolvida",
    PARCIALMENTE_DEVOLVIDA: "Devolução parcial",
  };

  return nomes[status] || status || "Não informado";
}

function classeStatus(status) {
  if (status === "CONCLUIDA") return "pill-success";
  if (status === "PENDENTE") return "pill-warning";

  if ([
    "CANCELADA",
    "DEVOLVIDA",
    "PARCIALMENTE_DEVOLVIDA",
  ].includes(status)) {
    return "pill-danger";
  }

  return "";
}

function obterPagamento(venda) {
  const pagamentos = Array.isArray(venda.pagamentos)
    ? venda.pagamentos
    : [];

  if (pagamentos.length === 0) {
    return "—";
  }

  const metodos = [
    ...new Set(pagamentos.map((p) => nomePagamento(p.metodo))),
  ];

  return metodos.join(" + ");
}

function renderizarTabela(vendas) {
  const tbody = $("tabela-vendas");

  if (vendas.length === 0) {
    tbody.innerHTML = "";
    $("tabela-wrapper").hidden = true;
    $("table-footer").hidden = true;

    $("estado-relatorio").hidden = false;
    $("estado-relatorio").innerHTML = `
      <span class="empty-icon">⌕</span>
      <strong>Nenhuma venda encontrada</strong>
      <p>Altere os filtros ou selecione outro período.</p>
    `;

    return;
  }

  $("estado-relatorio").hidden = true;
  $("tabela-wrapper").hidden = false;
  $("table-footer").hidden = false;

  tbody.innerHTML = vendas.map((venda) => {
    const id = obterValor(venda, ["id", "_id"], "—");
    const cliente = obterValor(
      venda,
      ["cliente.nome", "clienteNome"],
      "Consumidor"
    );
    const operador = obterValor(
      venda,
      ["operadorNome", "operador.nome", "operadorId"],
      "—"
    );
    const status = venda.status || "";
    const data = obterValor(venda, ["dataVenda", "createdAt"], null);
    const total = Number(venda.total || 0);

    return `
      <tr>
        <td>
          <span class="sale-id">${escaparHTML(id)}</span>
        </td>
        <td>
          <span class="sale-date">${formatarDataVenda(data)}</span>
        </td>
        <td>${escaparHTML(cliente)}</td>
        <td>${escaparHTML(operador)}</td>
        <td>${escaparHTML(obterPagamento(venda))}</td>
        <td>
          <span class="pill ${classeStatus(status)}">
            ${escaparHTML(nomeStatus(status))}
          </span>
        </td>
        <td class="text-right sale-total">
          ${formatarMoeda(total)}
        </td>
      </tr>
    `;
  }).join("");

  const inicio = estado.totalRegistros === 0
    ? 0
    : (estado.pagina - 1) * ITENS_POR_PAGINA + 1;

  const fim = Math.min(
    estado.pagina * ITENS_POR_PAGINA,
    estado.totalRegistros
  );

  $("contador-pagina").textContent =
    `${inicio}–${fim} de ${estado.totalRegistros} vendas`;

  $("btn-anterior").disabled = estado.pagina <= 1;
  $("btn-proximo").disabled =
    estado.pagina >= estado.totalPaginas;
}

function atualizarContagem(dados, vendas) {
  const totalInformado = obterValor(dados, [
    "totalRegistros",
    "total",
    "paginacao.total",
    "pagination.total",
    "meta.total",
  ]);

  const paginasInformadas = obterValor(dados, [
    "totalPaginas",
    "paginacao.totalPaginas",
    "pagination.totalPages",
    "meta.totalPages",
  ]);

  estado.totalRegistros = totalInformado != null
    ? Number(totalInformado)
    : vendas.length;

  estado.totalPaginas = paginasInformadas != null
    ? Math.max(1, Number(paginasInformadas))
    : Math.max(
        1,
        Math.ceil(estado.totalRegistros / ITENS_POR_PAGINA)
      );
}

function atualizarResumoTexto() {
  $("resumo-resultados").textContent =
    `${formatarNumero(estado.totalRegistros)} registro(s) encontrados`;
}

function definirCarregamento(ativo) {
  estado.carregando = ativo;

  [
    "btn-filtrar",
    "btn-atualizar",
    "btn-csv",
    "btn-pdf",
    "btn-limpar",
    "btn-anterior",
    "btn-proximo",
  ].forEach((id) => {
    const botao = $(id);
    if (botao) botao.disabled = ativo;
  });

  $("btn-filtrar").textContent = ativo
    ? "Consultando..."
    : "Consultar vendas";

  $("btn-atualizar").textContent = ativo
    ? "Atualizando..."
    : "↻ Atualizar relatório";
}

async function consultarRelatorio({ novaConsulta = true } = {}) {
  if (estado.carregando) return;

  try {
    coletarFiltros();
  } catch (erro) {
    await Swal.fire({
      icon: "warning",
      title: "Período inválido",
      text: erro.message,
    });
    return;
  }

  if (novaConsulta) {
    estado.pagina = 1;
  }

  definirCarregamento(true);

  $("estado-relatorio").hidden = false;
  $("estado-relatorio").innerHTML = `
    <span class="empty-icon">↻</span>
    <strong>Consultando vendas...</strong>
    <p>Aguarde enquanto buscamos os dados no servidor.</p>
  `;
  $("tabela-wrapper").hidden = true;
  $("table-footer").hidden = true;

  try {
    const parametros = construirParametros({
      incluirPaginacao: true,
    });

    const url = `${ENDPOINTS.relatorio}?${parametros.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(response);

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Sua sessão expirou ou você não tem permissão para acessar este relatório."
      );
    }

    if (!response.ok) {
      throw new Error(obterMensagemErro(dados, response.status));
    }

    const vendas = obterLista(dados);

    estado.vendas = vendas;
    estado.resumo = obterResumo(dados, vendas);
    estado.consultado = true;

    atualizarContagem(dados, vendas);
    atualizarIndicadores(estado.resumo);
    renderizarTabela(vendas);
    atualizarResumoTexto();

  } catch (erro) {
    console.error("[Relatório de vendas]", erro);

    estado.consultado = false;
    $("estado-relatorio").hidden = false;
    $("estado-relatorio").innerHTML = `
      <span class="empty-icon">!</span>
      <strong>Não foi possível carregar o relatório</strong>
      <p>${escaparHTML(erro.message || "Erro inesperado.")}</p>
    `;

    $("tabela-wrapper").hidden = true;
    $("table-footer").hidden = true;

    await Swal.fire({
      icon: "error",
      title: "Falha ao consultar",
      text: erro.message || "Não foi possível acessar a API.",
    });

  } finally {
    definirCarregamento(false);
  }
}

async function exportarArquivo(tipo) {
  if (estado.carregando) return;

  if (!estado.consultado) {
    await Swal.fire({
      icon: "info",
      title: "Consulte primeiro",
      text: "Faça uma consulta antes de exportar o relatório.",
    });
    return;
  }

  const endpoint = tipo === "csv"
    ? ENDPOINTS.csv
    : ENDPOINTS.pdf;

  const parametros = construirParametros();

  definirCarregamento(true);

  try {
    const response = await fetch(
      `${endpoint}?${parametros.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: tipo === "pdf"
            ? "application/pdf"
            : "text/csv, application/octet-stream",
        },
      }
    );

    if (!response.ok) {
      const dados = await lerResposta(response);
      throw new Error(obterMensagemErro(dados, response.status));
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error("O servidor retornou um arquivo vazio.");
    }

    const tipoConteudo = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    if (
      tipoConteudo.includes("application/json") ||
      tipoConteudo.includes("text/html")
    ) {
      const texto = await blob.text();

      let mensagem = texto;

      try {
        mensagem = obterMensagemErro(
          JSON.parse(texto),
          response.status
        );
      } catch {
        // O corpo não era JSON; usar o texto recebido.
      }

      throw new Error(
        mensagem || "O servidor não retornou o arquivo esperado."
      );
    }

    const extensao = tipo === "csv" ? "csv" : "pdf";
    const urlObjeto = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = urlObjeto;
    link.download = `relatorio-vendas-${new Date()
      .toISOString()
      .slice(0, 10)}.${extensao}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(urlObjeto), 1000);

  } catch (erro) {
    console.error(`[Exportação ${tipo}]`, erro);

    await Swal.fire({
      icon: "error",
      title: "Falha na exportação",
      text: erro.message || "Não foi possível gerar o arquivo.",
    });

  } finally {
    definirCarregamento(false);
  }
}

function limparFiltros() {
  $("form-filtros").reset();

  estado.filtros = {};
  estado.pagina = 1;
  estado.vendas = [];
  estado.resumo = {};
  estado.consultado = false;
  estado.totalRegistros = 0;
  estado.totalPaginas = 1;

  atualizarIndicadores({
    faturamento: 0,
    quantidade: 0,
    ticketMedio: 0,
    lucro: 0,
  });

  atualizarPeriodoSelecionado();

  $("estado-relatorio").hidden = false;
  $("estado-relatorio").innerHTML = `
    <span class="empty-icon">↗</span>
    <strong>Filtros limpos</strong>
    <p>Selecione o período desejado e consulte novamente.</p>
  `;

  $("tabela-vendas").innerHTML = "";
  $("tabela-wrapper").hidden = true;
  $("table-footer").hidden = true;
  $("resumo-resultados").textContent = "Nenhuma consulta realizada.";
}

function definirPeriodoInicial() {
  const hoje = new Date();
  const primeiroDia = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    1
  );

  const paraInput = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  };

  $("data-inicial").value = paraInput(primeiroDia);
  $("data-final").value = paraInput(hoje);

  atualizarPeriodoSelecionado();
}

document.addEventListener("DOMContentLoaded", () => {
  definirPeriodoInicial();

  $("form-filtros").addEventListener("submit", (evento) => {
    evento.preventDefault();
    consultarRelatorio();
  });

  $("btn-atualizar").addEventListener("click", () => {
    consultarRelatorio({ novaConsulta: false });
  });

  $("btn-limpar").addEventListener("click", limparFiltros);

  $("btn-csv").addEventListener("click", () => {
    exportarArquivo("csv");
  });

  $("btn-pdf").addEventListener("click", () => {
    exportarArquivo("pdf");
  });

  $("btn-anterior").addEventListener("click", () => {
    if (estado.pagina > 1 && !estado.carregando) {
      estado.pagina--;
      consultarRelatorio({ novaConsulta: false });
    }
  });

  $("btn-proximo").addEventListener("click", () => {
    if (
      estado.pagina < estado.totalPaginas &&
      !estado.carregando
    ) {
      estado.pagina++;
      consultarRelatorio({ novaConsulta: false });
    }
  });

  consultarRelatorio();
});
