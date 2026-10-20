
"use strict";

/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

  const API_BASE = "https://essenzaintimasapi.onrender.com";

const ENDPOINTS = {
  produtos: `${API_BASE}/products`,
  vendas: `${API_BASE}/vendas`,
  venderProduto: (id) =>
    `${API_BASE}/products/${encodeURIComponent(id)}/sell`,
};

/* =========================================================
   ESTADO
   ========================================================= */

const state = {
  produtos: [],
  carrinho: [],
  processando: false,
};

const $ = (id) => document.getElementById(id);

const moeda = (valor) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);

const centavos = (valor) =>
  Math.round((Number(valor) + Number.EPSILON) * 100);

const reais = (valorEmCentavos) => valorEmCentavos / 100;

function obterToken() {
  // Se seu login usa outra chave, altere TOKEN_KEY acima.
  return localStorage.getItem(TOKEN_KEY);
}


function obterHeaders(json = false) {
  const headers = {
    Accept: "application/json",
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function requisicao(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    // Envia cookies de autenticação automaticamente
    credentials: "include",

    headers: {
      ...obterHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });

  const texto = await response.text();
  let data = null;

  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = { message: texto };
    }
  }

  if (!response.ok) {
    const mensagem =
      data?.message ||
      data?.error ||
      data?.mensagem ||
      `Erro HTTP ${response.status}`;

    const error = new Error(mensagem);

    error.status = response.status;
    error.response = data;

    throw error;
  }

  return data;
}

/* =========================================================
   PRODUTOS E VARIAÇÕES
   ========================================================= */


function idProduto(produto) {
  alert(
    "[DEBUG ID PRODUTO]\n\n" +
    "id: " + String(produto?.id ?? "undefined") + "\n" +
    "_id: " + String(produto?._id ?? "undefined") + "\n" +
    "productId: " + String(produto?.productId ?? "undefined")
  );

  const id = String(
    produto?.id ||
    produto?._id ||
    produto?.productId ||
    ""
  );

  alert("[DEBUG] ID escolhido para o produto:\n" + (id || "VAZIO"));

  return id;
}


function nomeProduto(produto) {
  return String(produto?.nome || produto?.name || produto?.title || "Produto");
}

function precoProduto(produto) {
  return Number(
    produto?.preco ??
    produto?.price ??
    produto?.valor ??
    0
  );
}

function variantesProduto(produto) {
  const variantes = produto?.variantes || produto?.skus || [];
  return Array.isArray(variantes) ? variantes : [];
}

function idSku(variante) {
  return String(
    variante?.size ||
    variante?._id ||
    variante?.id ||
    variante?.skuId ||
    variante?.sku ||
    ""
  );
}

function codigoSku(variante) {
  return String(
    variante?.sku ||
    variante?.codigo ||
    variante?.code ||
    idSku(variante)
  );
}

function nomeSku(variante) {
  const tamanho = variante?.tamanho || variante?.size;
  const cor = variante?.cor || variante?.color;
  const partes = [tamanho, cor].filter(Boolean);

  return partes.length
    ? partes.join(" / ")
    : codigoSku(variante);
}

function precoSku(variante, produto) {
  return Number(
    variante?.preco ??
    variante?.price ??
    precoProduto(produto)
  );
}

function estoqueSku(variante) {
  return Number(
    variante?.stock ??
    variante?.estoque ??
    variante?.quantidadeEstoque ??
    0
  );
}

function estoqueProduto(produto) {
  return Number(
    produto?.stock ??
    produto?.estoque ??
    produto?.quantidadeEstoque ??
    0
  );
}

function produtoAtivo(produto) {
  const status = String(produto?.status || "ACTIVE").toUpperCase();

  return ![
    "INACTIVE",
    "INATIVO",
    "INATIVA",
    "INACTIVE",
    "DELETED",
    "EXCLUIDO",
  ].includes(status);
}

function produtoDisponivel(produto) {
  const variantes = variantesProduto(produto);

  if (variantes.length > 0) {
    return variantes.some((variante) => estoqueSku(variante) > 0);
  }

  return estoqueProduto(produto) > 0;
}

function categoriaProduto(produto) {
  return String(
    produto?.categoria ||
    produto?.category ||
    "Sem categoria"
  );
}

async function carregarProdutos() {
  $("productGrid").innerHTML =
    '<div class="empty-products">Carregando produtos...</div>';

  try {
    const resposta = await requisicao(ENDPOINTS.produtos);

    const lista = Array.isArray(resposta)
      ? resposta
      : resposta?.products ||
        resposta?.produtos ||
        resposta?.data ||
        [];

    if (!Array.isArray(lista)) {
      throw new Error("A API não retornou uma lista válida de produtos.");
    }

    state.produtos = lista.filter(
      (produto) => produtoAtivo(produto) && produtoDisponivel(produto)
    );

    renderizarCategorias();
    renderizarProdutos();
    mostrarAviso(
      `${state.produtos.length} produto(s) disponível(is).`,
      "success"
    );
  } catch (error) {
    $("productGrid").innerHTML = `
      <div class="empty-products">
        Não foi possível carregar os produtos.<br><br>
        ${escaparHTML(error.message)}
      </div>
    `;

    mostrarAviso(error.message, "error");
  }
}

/* =========================================================
   SEGURANÇA DE EXIBIÇÃO
   ========================================================= */

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[caractere]);
}

/* =========================================================
   CATÁLOGO
   ========================================================= */

function renderizarCategorias() {
  const select = $("categoryFilter");
  const categoriaAnterior = select.value;

  const categorias = [
    ...new Set(state.produtos.map(categoriaProduto)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = '<option value="">Todas as categorias</option>';

  for (const categoria of categorias) {
    const option = document.createElement("option");
    option.value = categoria;
    option.textContent = categoria;
    select.appendChild(option);
  }

  if (categorias.includes(categoriaAnterior)) {
    select.value = categoriaAnterior;
  }
}

function renderizarProdutos() {
  const grid = $("productGrid");
  const busca = $("search").value.trim().toLocaleLowerCase("pt-BR");
  const categoriaSelecionada = $("categoryFilter").value;

  const produtos = state.produtos.filter((produto) => {
    const correspondeNome = nomeProduto(produto)
      .toLocaleLowerCase("pt-BR")
      .includes(busca);

    const correspondeCategoria =
      !categoriaSelecionada ||
      categoriaProduto(produto) === categoriaSelecionada;

    return correspondeNome && correspondeCategoria;
  });

  if (!produtos.length) {
    grid.innerHTML =
      '<div class="empty-products">Nenhum produto encontrado.</div>';
    return;
  }

  grid.innerHTML = produtos.map((produto, index) => {
    const id = idProduto(produto);
    const nome = nomeProduto(produto);
    const categoria = categoriaProduto(produto);
    const variantes = variantesProduto(produto);

    const preco = precoProduto(produto);
    const estoque = variantes.length
      ? variantes.reduce((total, v) => total + estoqueSku(v), 0)
      : estoqueProduto(produto);

    const temVariantes = variantes.length > 0;

    const opcoesSku = temVariantes
      ? `
        <select class="field sku-selector" data-product-index="${index}">
          ${variantes.map((variante) => {
            const sku = idSku(variante);
            const disponivel = estoqueSku(variante) > 0;

            return `
              <option
                value="${escaparHTML(sku)}"
                ${disponivel ? "" : "disabled"}
              >
                ${escaparHTML(nomeSku(variante))}
                — ${moeda(precoSku(variante, produto))}
                ${disponivel ? `(${estoqueSku(variante)} un.)` : "(esgotado)"}
              </option>
            `;
          }).join("")}
        </select>
      `
      : "";

    const primeiraVarianteDisponivel = temVariantes
      ? variantes.find((v) => estoqueSku(v) > 0)
      : null;

    const precoExibido = primeiraVarianteDisponivel
      ? precoSku(primeiraVarianteDisponivel, produto)
      : preco;

    return `
      <article class="product" data-product-id="${escaparHTML(id)}">
        <div class="product-category">${escaparHTML(categoria)}</div>
        <h3>${escaparHTML(nome)}</h3>
        <div class="price">${moeda(precoExibido)}</div>
        <div class="stock ${estoque <= 3 ? "low" : ""}">
          ${estoque} unidade(s) em estoque
        </div>
        ${opcoesSku}
        <button
          type="button"
          class="btn btn-primary btn-full add-product"
          data-product-index="${index}"
          ${estoque <= 0 ? "disabled" : ""}
        >
          Adicionar
        </button>
      </article>
    `;
  }).join("");
}

/* =========================================================
   CARRINHO
   ========================================================= */

function chaveCarrinho(productId, skuId) {
  return `${productId}::${skuId || "SEM_SKU"}`;
}

function adicionarProduto(produto, variante = null) {
  const productId = idProduto(produto);

  if (!productId) {
    mostrarAviso("O produto não possui um identificador válido.", "error");
    return;
  }

  const sku = variante ? idSku(variante) : null;

  if (variante && !sku) {
    mostrarAviso("A variação não possui um identificador válido.", "error");
    return;
  }

  const estoque = variante
    ? estoqueSku(variante)
    : estoqueProduto(produto);

  const preco = variante
    ? precoSku(variante, produto)
    : precoProduto(produto);

  if (estoque <= 0) {
    mostrarAviso("Este produto está sem estoque.", "error");
    return;
  }

  if (!Number.isFinite(preco) || preco < 0) {
    mostrarAviso("O produto possui um preço inválido.", "error");
    return;
  }

  const chave = chaveCarrinho(productId, sku);

  const existente = state.carrinho.find(
    (item) => item.chave === chave
  );

  if (existente) {
    if (existente.quantidade >= estoque) {
      mostrarAviso("Quantidade maior que o estoque disponível.", "error");
      return;
    }

    existente.quantidade += 1;
  } else {
    state.carrinho.push({
      chave,
      productId,
      skuId: sku,
      sku: variante ? codigoSku(variante) : null,
      nome: nomeProduto(produto),
      categoria: categoriaProduto(produto),
      nomeVariante: variante ? nomeSku(variante) : null,
      precoUnitario: preco,
      quantidade: 1,
      estoqueDisponivel: estoque,
    });
  }

  renderizarCarrinho();
}

function alterarQuantidade(chave, variacao) {
  const item = state.carrinho.find((i) => i.chave === chave);
  if (!item) return;

  const novaQuantidade = item.quantidade + variacao;

  if (novaQuantidade <= 0) {
    state.carrinho = state.carrinho.filter((i) => i.chave !== chave);
  } else if (novaQuantidade > item.estoqueDisponivel) {
    mostrarAviso("Quantidade maior que o estoque disponível.", "error");
    return;
  } else {
    item.quantidade = novaQuantidade;
  }

  renderizarCarrinho();
}

function subtotalCentavos() {
  return state.carrinho.reduce(
    (soma, item) =>
      soma + centavos(item.precoUnitario) * item.quantidade,
    0
  );
}

function valorCampoCentavos(id) {
  const valor = Number($(id).value || 0);

  if (!Number.isFinite(valor) || valor < 0) {
    return NaN;
  }

  return centavos(valor);
}

function calcularTotalCentavos() {
  const subtotal = subtotalCentavos();
  const desconto = valorCampoCentavos("discount");
  const acrescimo = valorCampoCentavos("addition");

  if (!Number.isFinite(desconto) || !Number.isFinite(acrescimo)) {
    return NaN;
  }

  if (desconto > subtotal) {
    return NaN;
  }

  return subtotal - desconto + acrescimo;
}

function renderizarCarrinho() {
  const container = $("cartItems");

  if (!state.carrinho.length) {
    container.innerHTML =
      '<div class="empty">Seu carrinho está vazio.</div>';
  } else {
    container.innerHTML = state.carrinho.map((item) => `
      <div class="cart-item">
        <div class="cart-item-title">${escaparHTML(item.nome)}</div>
        <div class="cart-item-meta">
          ${item.nomeVariante ? `${escaparHTML(item.nomeVariante)} · ` : ""}
          ${moeda(item.precoUnitario)} cada
        </div>
        <div class="cart-item-row">
          <div class="quantity">
            <button type="button" data-action="minus"
              data-key="${escaparHTML(item.chave)}">−</button>
            <strong>${item.quantidade}</strong>
            <button type="button" data-action="plus"
              data-key="${escaparHTML(item.chave)}">+</button>
          </div>
          <strong>${moeda(item.precoUnitario * item.quantidade)}</strong>
        </div>
        <div style="text-align:right;margin-top:6px">
          <button class="remove" type="button"
            data-action="remove"
            data-key="${escaparHTML(item.chave)}">
            Remover
          </button>
        </div>
      </div>
    `).join("");
  }

  const quantidade = state.carrinho.reduce(
    (soma, item) => soma + item.quantidade,
    0
  );

  $("cartCount").textContent = quantidade;
  $("subtotal").textContent = moeda(reais(subtotalCentavos()));

  const total = calcularTotalCentavos();

  $("total").textContent = Number.isFinite(total)
    ? moeda(reais(total))
    : "Valor inválido";

  atualizarTroco();
}

/* =========================================================
   PAGAMENTO
   ========================================================= */

function atualizarTroco() {
  const dinheiro = $("paymentMethod").value === "DINHEIRO";
  const recebidoLabel = $("cashReceivedLabel");
  const trocoLine = $("changeLine");

  recebidoLabel.hidden = !dinheiro;
  trocoLine.hidden = !dinheiro;

  if (!dinheiro) {
    $("change").textContent = moeda(0);
    return;
  }

  const recebido = Number($("cashReceived").value || 0);
  const total = calcularTotalCentavos();
  const recebidoCentavos = centavos(recebido);

  if (
    Number.isFinite(total) &&
    Number.isFinite(recebidoCentavos) &&
    recebidoCentavos >= total
  ) {
    $("change").textContent = moeda(
      reais(recebidoCentavos - total)
    );
  } else {
    $("change").textContent = "—";
  }
}

function validarVenda() {
  if (!state.carrinho.length) {
    throw new Error("Adicione pelo menos um produto.");
  }

  const subtotal = subtotalCentavos();
  const desconto = valorCampoCentavos("discount");
  const acrescimo = valorCampoCentavos("addition");
  const total = calcularTotalCentavos();

  if (
    !Number.isFinite(desconto) ||
    !Number.isFinite(acrescimo) ||
    !Number.isFinite(total) ||
    desconto < 0 ||
    acrescimo < 0 ||
    desconto > subtotal ||
    total < 0
  ) {
    throw new Error("Confira o desconto, o acréscimo e o total.");
  }

  if (total === 0) {
    throw new Error("O total da venda deve ser maior que zero.");
  }

  const metodo = $("paymentMethod").value;

  if (metodo === "DINHEIRO") {
    const recebido = Number($("cashReceived").value || 0);

    if (!Number.isFinite(recebido) || centavos(recebido) < total) {
      throw new Error("O valor recebido é insuficiente.");
    }
  }

  return {
    subtotal: reais(subtotal),
    desconto: reais(desconto),
    acrescimo: reais(acrescimo),
    total: reais(total),
    metodo,
  };
}

/* =========================================================
   FINALIZAÇÃO
   ========================================================= */

/*
 * IMPORTANTE:
 * Esta implementação chama a rota de baixa para cada item e,
 * depois, registra a venda em POST /vendas.
 *
 * Isso NÃO é uma operação atômica. Se um item for baixado e a
 * próxima chamada falhar, o estoque poderá ficar parcialmente
 * atualizado. Para produção, prefira um endpoint backend que
 * coordene todas as baixas e a gravação da venda numa transação.
 *
 * O endpoint POST /vendas deve apenas registrar a venda neste
 * fluxo, sem descontar novamente o estoque.
 */

async function baixarEstoqueDoItem(item) {
  const body = {
    quantity: item.quantidade,
  };

  if (item.skuId) {
    body.skuId = item.skuId;
  }

  return requisicao(ENDPOINTS.venderProduto(item.productId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}


async function registrarVenda(dados, itens) {
  alert(
    "[DEBUG 1 — REGISTRAR VENDA]\n\n" +
    "Total: " + dados.total + "\n" +
    "Desconto: " + dados.desconto + "\n" +
    "Acréscimo: " + dados.acrescimo + "\n" +
    "Itens: " + itens.length
  );

  alert(
    "[DEBUG 2 — DADOS DO CARRINHO]\n\n" +
    JSON.stringify(
      itens.map((item) => ({
        productId: item.productId,
        skuId: item.skuId,
        sku: item.sku,
        nome: item.nome,
        preco: item.preco,
        precoUnitario: item.precoUnitario,
        quantidade: item.quantidade,
      })),
      null,
      2
    )
  );

  const body = {
    caixaId: null,
    cliente: {
      nome: $("customerName").value.trim() || null,
      telefone: $("customerPhone").value.trim() || null,
    },
    itens: itens.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      quantidade: item.quantidade,
    })),
    desconto: dados.desconto,
    acrescimo: dados.acrescimo,
    pagamentos: [{
      metodo: dados.metodo,
      valor: dados.total,
      parcelas: 1,
    }],
    observacoes: $("observations").value.trim() || null,
    origem: "PDV",
  };

  alert(
    "[DEBUG 3 — BODY ENVIADO PARA /vendas]\n\n" +
    JSON.stringify(body, null, 2)
  );

  try {
    const resposta = await requisicao(ENDPOINTS.vendas, {
      method: "POST",
      body: JSON.stringify(body),
    });

    alert(
      "[DEBUG 4 — RESPOSTA DA VENDA]\n\n" +
      JSON.stringify(resposta, null, 2)
    );

    return resposta;
  } catch (error) {
    alert(
      "[DEBUG 4 — ERRO DA API]\n\n" +
      "Mensagem: " + error.message + "\n" +
      "Status HTTP: " + (error.status ?? "desconhecido") + "\n" +
      "Resposta: " + JSON.stringify(error.response ?? null, null, 2)
    );

    throw error;
  }
}

async function finalizarVenda() {
  if (state.processando) return;

  let dados;

  try {
    dados = validarVenda();
    obterHeaders(true);
  } catch (error) {
    alert("[DEBUG — VALIDAÇÃO]\n\n" + error.message);
    mostrarAviso(error.message, "error");
    return;
  }

  const confirmacao = window.confirm(
    `Confirmar venda de ${moeda(dados.total)}?\n\n` +
    `Pagamento: ${dados.metodo.replaceAll("_", " ")}`
  );

  if (!confirmacao) return;

  state.processando = true;
  $("finishSale").disabled = true;
  $("finishSale").textContent = "Processando venda...";

  const itens = state.carrinho.map((item) => ({ ...item }));

  try {
    await carregarProdutosSilencioso();

    alert(
      "[DEBUG 5 — PRODUTOS DO CATÁLOGO]\n\n" +
      JSON.stringify(
        state.produtos.map((produto) => ({
          id: produto.id,
          _id: produto._id,
          productId: produto.productId,
          nome: produto.nome ?? produto.name,
          price: produto.price,
          preco: produto.preco,
          stock: produto.stock,
          skus: produto.skus ?? produto.variantes,
        })),
        null,
        2
      )
    );

    for (const item of itens) {
      const produtoAtual = state.produtos.find(
        (produto) => idProduto(produto) === String(item.productId)
      );

      if (!produtoAtual) {
        throw new Error(
          `Produto não encontrado no catálogo: ${item.nome} (${item.productId})`
        );
      }

      const varianteAtual = item.skuId
        ? variantesProduto(produtoAtual).find(
            (variante) => idSku(variante) === String(item.skuId)
          )
        : null;

      if (item.skuId && !varianteAtual) {
        throw new Error(
          `Variação não encontrada: ${item.nome}, SKU ${item.skuId}`
        );
      }

      alert(
        "[DEBUG 6 — PREÇO E ESTOQUE]\n\n" +
        "Produto: " + (item.nome ?? "Sem nome") + "\n" +
        "ID enviado: " + item.productId + "\n" +
        "SKU ID: " + (item.skuId ?? "Nenhum") + "\n" +
        "Preço no carrinho: " + item.preco + "\n" +
        "Preço unitário: " + item.precoUnitario + "\n" +
        "Preço no produto: " +
          (produtoAtual.price ?? produtoAtual.preco ?? "indefinido") + "\n" +
        "Preço no SKU: " +
          (varianteAtual?.price ?? varianteAtual?.preco ?? "indefinido") + "\n" +
        "Estoque do produto: " + estoqueProduto(produtoAtual) + "\n" +
        "Estoque do SKU: " +
          (varianteAtual ? estoqueSku(varianteAtual) : "N/A")
      );

      const estoqueAtual = varianteAtual
        ? estoqueSku(varianteAtual)
        : estoqueProduto(produtoAtual);

      if (estoqueAtual < item.quantidade) {
        throw new Error(
          `Estoque insuficiente para "${item.nome}". Disponível: ${estoqueAtual}.`
        );
      }
    }

    alert(
      "[DEBUG 7]\nValidação concluída. Iniciando baixas de estoque."
    );

    for (const item of itens) {
      alert(
        "[DEBUG 8 — BAIXA DE ESTOQUE]\n\n" +
        "Produto: " + item.nome + "\n" +
        "ID enviado: " + item.productId + "\n" +
        "Quantidade: " + item.quantidade + "\n" +
        "SKU ID: " + (item.skuId ?? "Nenhum")
      );

      await baixarEstoqueDoItem(item);
    }

    alert(
      "[DEBUG 9]\nBaixas concluídas. Agora registrando a venda."
    );

    const venda = await registrarVenda(dados, itens);

    state.carrinho = [];
    $("discount").value = "0";
    $("addition").value = "0";
    $("cashReceived").value = "";
    $("customerName").value = "";
    $("customerPhone").value = "";
    $("observations").value = "";

    renderizarCarrinho();
    await carregarProdutos();

    const codigo =
      venda?.id ||
      venda?.venda?.id ||
      venda?._id ||
      "Venda registrada";

    alert("[DEBUG 10 — SUCESSO]\n\n" + codigo);

    mostrarAviso(
      `Venda concluída. Referência: ${codigo}`,
      "success"
    );
  } catch (error) {
    alert(
      "[DEBUG — FALHA NA FINALIZAÇÃO]\n\n" +
      "Erro: " + error.message + "\n" +
      "Status: " + (error.status ?? "N/A") + "\n" +
      "Resposta: " + JSON.stringify(error.response ?? null)
    );

    mostrarAviso(
      `Não foi possível concluir a venda: ${error.message}. Confira o estoque e o histórico antes de tentar novamente.`,
      "error"
    );

    try {
      await carregarProdutosSilencioso();
      renderizarProdutos();
    } catch (reloadError) {
      alert(
        "[DEBUG — ERRO AO RECARREGAR]\n\n" +
        reloadError.message
      );
    }
  } finally {
    state.processando = false;
    $("finishSale").disabled = false;
    $("finishSale").textContent = "Finalizar venda";
  }
}

async function carregarProdutosSilencioso() {
  const resposta = await requisicao(ENDPOINTS.produtos);

  const lista = Array.isArray(resposta)
    ? resposta
    : resposta?.products ||
      resposta?.produtos ||
      resposta?.data ||
      [];

  if (!Array.isArray(lista)) {
    throw new Error("Resposta de produtos inválida.");
  }

  state.produtos = lista.filter(
    (produto) => produtoAtivo(produto) && produtoDisponivel(produto)
  );
}

/* =========================================================
   MENSAGENS E EVENTOS
   ========================================================= */

function mostrarAviso(mensagem, tipo = "info") {
  const notice = $("notice");
  notice.className = `notice show ${tipo}`;
  notice.textContent = mensagem;
}

function configurarEventos() {
  $("search").addEventListener("input", renderizarProdutos);
  $("categoryFilter").addEventListener("change", renderizarProdutos);

  $("reloadProducts").addEventListener("click", carregarProdutos);

  $("discount").addEventListener("input", renderizarCarrinho);
  $("addition").addEventListener("input", renderizarCarrinho);
  $("cashReceived").addEventListener("input", atualizarTroco);

  $("paymentMethod").addEventListener("change", atualizarTroco);

  $("productGrid").addEventListener("click", (event) => {
    const botao = event.target.closest(".add-product");
    if (!botao) return;

    const indice = Number(botao.dataset.productIndex);
    const produto = state.produtos[indice];

    if (!produto) {
      mostrarAviso("Produto não encontrado. Atualize o catálogo.", "error");
      return;
    }

    const card = botao.closest(".product");
    const seletor = card.querySelector(".sku-selector");

    let variante = null;

    if (seletor) {
      const skuIdSelecionado = seletor.value;

      variante = variantesProduto(produto).find(
        (v) => idSku(v) === skuIdSelecionado
      );

      if (!variante || estoqueSku(variante) <= 0) {
        mostrarAviso("Selecione uma variação com estoque.", "error");
        return;
      }
    }

    adicionarProduto(produto, variante);
    mostrarAviso("Produto adicionado ao carrinho.", "success");
  });

  $("cartItems").addEventListener("click", (event) => {
    const botao = event.target.closest("[data-action]");
    if (!botao) return;

    const { action, key } = botao.dataset;

    if (action === "plus") alterarQuantidade(key, 1);
    if (action === "minus") alterarQuantidade(key, -1);

    if (action === "remove") {
      state.carrinho = state.carrinho.filter(
        (item) => item.chave !== key
      );

      renderizarCarrinho();
    }
  });

  $("clearCart").addEventListener("click", () => {
    if (state.processando) return;

    if (
      state.carrinho.length &&
      !window.confirm("Deseja limpar o carrinho?")
    ) {
      return;
    }

    state.carrinho = [];
    renderizarCarrinho();
    mostrarAviso("Carrinho limpo.", "info");
  });

  $("finishSale").addEventListener("click", finalizarVenda);
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  configurarEventos();
  renderizarCarrinho();

  try {
    obterHeaders();
    await carregarProdutos();
  } catch (error) {
    mostrarAviso(error.message, "error");
    $("productGrid").innerHTML =
      '<div class="empty-products">Faça login para acessar o PDV.</div>';
  }
});
